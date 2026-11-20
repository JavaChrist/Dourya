import { StripeError, encodeForm, isStripeCheckoutUrl, type StripeCall } from "./stripe-client";

/**
 * Stripe Billing for the Mail Club: a monthly subscription started on the
 * Stripe-hosted Checkout page (mode "subscription"), read back and cancelled
 * at the end of the paid period. Plain fetch through the shared caller, no
 * SDK; kept free of server-only imports so it can be tested with a fake fetch.
 *
 * Only the fields the shop needs are kept from Stripe's objects. The price is
 * sent inline (price_data, recurring monthly): no product or price has to be
 * created by hand in the Stripe dashboard.
 */

export type SubscriptionStatus = "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";
const STATUSES: readonly SubscriptionStatus[] = ["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"];

/** Statuses where the customer is still subscribed (a new subscription is refused). */
export const LIVE_STATUSES: readonly SubscriptionStatus[] = ["trialing", "active", "past_due", "unpaid"];

export type ShippingAddress = { name: string; line1: string; line2?: string; postalCode: string; city: string; country: string };

export type SubscriptionView = {
  id: string;
  customerId: string | null;
  status: SubscriptionStatus;
  /** Firebase uid of the customer, from the metadata this server set. */
  uid: string | null;
  /** End of the paid period (unix seconds): next charge, or end of the subscription when cancelled. */
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  priceCents: number | null;
  shipping: ShippingAddress | null;
  /** false for an object of Stripe's test mode (test key): never a real payment. */
  livemode: boolean;
};

export type InvoiceView = { id: string; subscriptionId: string | null; paid: boolean; amountPaidCents: number; paidAt: number | null; livemode: boolean };

export type SubscriptionCheckout = { id: string; url: string };
export type SubscriptionCheckoutResult = { id: string; uid: string | null; subscriptionId: string | null; complete: boolean };

const SUB_ID = /^sub_[A-Za-z0-9]{1,100}$/;
const INVOICE_ID = /^in_[A-Za-z0-9]{1,100}$/;
const CUSTOMER_ID = /^cus_[A-Za-z0-9]{1,100}$/;
const SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]{1,100}$/;
/** Firebase uids: letters, digits, - and _ (as created by Firebase Auth). */
const UID = /^[A-Za-z0-9_-]{1,128}$/;

export const isSubscriptionId = (v: unknown): v is string => typeof v === "string" && SUB_ID.test(v);
export const isInvoiceId = (v: unknown): v is string => typeof v === "string" && INVOICE_ID.test(v);
export const isUid = (v: unknown): v is string => typeof v === "string" && UID.test(v);

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
const text = (v: unknown, max = 200): string | undefined => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : undefined);
const idOf = (v: unknown): unknown => (typeof v === "string" ? v : obj(v)?.id);

function parseShipping(raw: unknown): ShippingAddress | null {
  const s = obj(raw);
  const a = obj(s?.address);
  const name = text(s?.name);
  const line1 = text(a?.line1);
  const postalCode = text(a?.postal_code, 20);
  const city = text(a?.city);
  const country = text(a?.country, 2);
  if (!name || !line1 || !postalCode || !city || !country) return null;
  const line2 = text(a?.line2);
  return { name, line1, ...(line2 ? { line2 } : {}), postalCode, city, country };
}

/**
 * A Subscription with `customer` expanded. Newer API versions carry the
 * period on the subscription item, older ones on the subscription: both read.
 */
export function parseSubscription(body: unknown): SubscriptionView {
  const b = obj(body);
  if (!b || !isSubscriptionId(b.id) || !STATUSES.includes(b.status as SubscriptionStatus)) throw new StripeError("bad_response", null);
  const items = obj(b.items);
  const item = Array.isArray(items?.data) ? obj(items.data[0]) : null;
  const price = obj(item?.price);
  const customer = obj(b.customer);
  const customerId = idOf(b.customer);
  const uid = obj(b.metadata)?.uid;
  return {
    id: b.id,
    customerId: typeof customerId === "string" && CUSTOMER_ID.test(customerId) ? customerId : null,
    status: b.status as SubscriptionStatus,
    uid: isUid(uid) ? uid : null,
    currentPeriodEnd: int(item?.current_period_end) ?? int(b.current_period_end),
    cancelAtPeriodEnd: b.cancel_at_period_end === true,
    priceCents: int(price?.unit_amount),
    shipping: parseShipping(customer?.shipping),
    livemode: b.livemode === true,
  };
}

/** An Invoice. The subscription is under `parent.subscription_details` in newer API versions. */
export function parseInvoice(body: unknown): InvoiceView {
  const b = obj(body);
  const amount = int(b?.amount_paid);
  if (!b || !isInvoiceId(b.id) || amount === null) throw new StripeError("bad_response", null);
  const sub = idOf(obj(obj(b.parent)?.subscription_details)?.subscription) ?? idOf(b.subscription);
  return {
    id: b.id,
    subscriptionId: isSubscriptionId(sub) ? sub : null,
    paid: b.status === "paid",
    amountPaidCents: amount,
    paidAt: int(obj(b.status_transitions)?.paid_at),
    livemode: b.livemode === true,
  };
}

export type CreateSubscriptionCheckoutInput = {
  uid: string;
  email: string;
  productName: string;
  priceCents: number;
  /** ISO country codes Stripe may ship to (collected on its page). */
  shippingCountries: readonly string[];
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
};

export type SubscriptionClient = {
  createSubscriptionCheckout(input: CreateSubscriptionCheckoutInput): Promise<SubscriptionCheckout>;
  /** The subscription a Checkout Session created (return page), or null while it is not complete. */
  getSubscriptionCheckout(sessionId: string): Promise<SubscriptionCheckoutResult>;
  getSubscription(id: string): Promise<SubscriptionView>;
  getInvoice(id: string): Promise<InvoiceView>;
  /** No further payment; the period already paid runs to its end. */
  cancelAtPeriodEnd(id: string, idempotencyKey: string): Promise<SubscriptionView>;
  /** Stops the subscription at once (withdrawal): no further invoice. The refund is made apart, in Stripe. */
  cancelNow(id: string): Promise<SubscriptionView>;
};

const EXPAND_CUSTOMER = "expand[]=customer";

export function createSubscriptionClient(call: StripeCall): SubscriptionClient {
  return {
    async createSubscriptionCheckout(input) {
      if (!isUid(input.uid)) throw new StripeError("invalid_request", null);
      const body = encodeForm({
        mode: "subscription",
        client_reference_id: input.uid,
        customer_email: input.email,
        locale: "fr",
        line_items: [
          {
            quantity: 1,
            price_data: { currency: "eur", unit_amount: input.priceCents, recurring: { interval: "month" }, product_data: { name: input.productName } },
          },
        ],
        shipping_address_collection: { allowed_countries: [...input.shippingCountries] },
        metadata: { uid: input.uid, kind: "mail_club" },
        subscription_data: { metadata: { uid: input.uid, kind: "mail_club" } },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      });
      const created = obj(await call("/checkout/sessions", { method: "POST", body, idempotencyKey: input.idempotencyKey }));
      if (!created || typeof created.id !== "string" || !SESSION_ID.test(created.id) || !isStripeCheckoutUrl(created.url)) throw new StripeError("bad_response", null);
      return { id: created.id, url: created.url };
    },
    async getSubscriptionCheckout(sessionId) {
      if (!SESSION_ID.test(sessionId)) throw new StripeError("not_found", null);
      const b = obj(await call(`/checkout/sessions/${sessionId}`));
      if (!b || b.id !== sessionId || b.mode !== "subscription") throw new StripeError("bad_response", null);
      const sub = idOf(b.subscription);
      return {
        id: sessionId,
        uid: isUid(b.client_reference_id) ? b.client_reference_id : null,
        subscriptionId: isSubscriptionId(sub) ? sub : null,
        complete: b.status === "complete",
      };
    },
    async getSubscription(id) {
      if (!isSubscriptionId(id)) throw new StripeError("not_found", null);
      return parseSubscription(await call(`/subscriptions/${id}?${EXPAND_CUSTOMER}`));
    },
    async getInvoice(id) {
      if (!isInvoiceId(id)) throw new StripeError("not_found", null);
      return parseInvoice(await call(`/invoices/${id}`));
    },
    async cancelAtPeriodEnd(id, idempotencyKey) {
      if (!isSubscriptionId(id)) throw new StripeError("not_found", null);
      const body = `cancel_at_period_end=true&${EXPAND_CUSTOMER}`;
      return parseSubscription(await call(`/subscriptions/${id}`, { method: "POST", body, idempotencyKey }));
    },
    async cancelNow(id) {
      if (!isSubscriptionId(id)) throw new StripeError("not_found", null);
      return parseSubscription(await call(`/subscriptions/${id}?${EXPAND_CUSTOMER}`, { method: "DELETE" }));
    },
  };
}
