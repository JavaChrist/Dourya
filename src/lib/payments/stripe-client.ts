import type { PaymentView } from "@/lib/orders/payment-status";

/**
 * Minimal Stripe REST client (Checkout Sessions, plain fetch, no SDK). Kept
 * free of server-only imports so it can be unit-tested with a fake fetch;
 * the server wrapper (stripe.ts) gives it the secret key.
 *
 * Never logs or returns the key, the request body or Stripe's raw error
 * message: errors carry an HTTP status, a short known category and, when
 * Stripe gives them, its error type/code/param identifiers (no values).
 */

export const STRIPE_API = "https://api.stripe.com/v1";

export type StripeMode = "test" | "live";

/** "test" / "live" from the secret (sk_) or restricted (rk_) key prefix, null when missing or malformed. */
export function stripeKeyMode(key: string | undefined): StripeMode | null {
  const match = /^(?:sk|rk)_(test|live)_[A-Za-z0-9]{20,}$/.exec(key?.trim() ?? "");
  return match ? (match[1] as StripeMode) : null;
}

export type StripeErrorCategory = "not_found" | "unauthorized" | "invalid_request" | "idempotency" | "rate_limited" | "unavailable" | "bad_response" | "network";

/**
 * Machine-readable part of a Stripe error body (type, code, param), kept only
 * when each field is a plain identifier: never the message, never a value
 * sent by the customer. `param` names the rejected field (e.g. "customer_email").
 */
export type StripeErrorDetail = { type?: string; code?: string; param?: string };

const SAFE_ID = /^[A-Za-z0-9_.[\]]{1,100}$/;

/** Known Stripe messages without a code, mapped to a fixed label (the message itself is never kept). */
const KNOWN_MESSAGES: [RegExp, string][] = [[/business name|account name|display name/i, "account_name_missing"]];

export function stripeErrorDetail(body: unknown): StripeErrorDetail | undefined {
  const error = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  if (!error || typeof error !== "object") return undefined;
  const e = error as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === "string" && SAFE_ID.test(v) ? v : undefined);
  const known = typeof e.message === "string" ? KNOWN_MESSAGES.find(([re]) => re.test(e.message as string))?.[1] : undefined;
  const detail: StripeErrorDetail = { type: pick(e.type), code: pick(e.code) ?? known, param: pick(e.param) };
  return detail.type || detail.code || detail.param ? detail : undefined;
}

export class StripeError extends Error {
  constructor(
    readonly category: StripeErrorCategory,
    readonly status: number | null,
    readonly detail?: StripeErrorDetail,
  ) {
    super(`stripe_${category}`);
    this.name = "StripeError";
  }
}

function categoryFor(status: number): StripeErrorCategory {
  if (status === 404) return "not_found";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 409) return "idempotency";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "invalid_request";
}

export type CheckoutSession = PaymentView & {
  /** Stripe-hosted payment page, only while the session is open. */
  url?: string;
};

const SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]{1,100}$/;
const PAYMENT_INTENT_ID = /^pi_[A-Za-z0-9]{1,100}$/;

export const isCheckoutSessionId = (id: unknown): id is string => typeof id === "string" && SESSION_ID.test(id);
export const isPaymentIntentId = (id: unknown): id is string => typeof id === "string" && PAYMENT_INTENT_ID.test(id);

/** The only payment pages a customer is ever sent to. */
export function isStripeCheckoutUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
}

const isCents = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);

/**
 * Keeps only the fields the shop reads from a Checkout Session (with
 * `payment_intent.latest_charge` expanded), and maps its state:
 * open -> open, expired -> expired, complete + paid -> paid,
 * complete + unpaid -> failed if the PaymentIntent gave up, pending otherwise.
 */
export function parseSession(body: unknown): CheckoutSession {
  const b = obj(body);
  if (!b || !isCheckoutSessionId(b.id) || !isCents(b.amount_total) || typeof b.currency !== "string") throw new StripeError("bad_response", null);
  const intent = obj(b.payment_intent);
  const charge = obj(intent?.latest_charge);
  const refunded = charge?.amount_refunded ?? 0;
  if (!isCents(refunded)) throw new StripeError("bad_response", null);

  let status: PaymentView["status"];
  if (b.status === "open") status = "open";
  else if (b.status === "expired") status = "expired";
  else if (b.status === "complete") {
    if (b.payment_status === "paid") status = "paid";
    else if (b.payment_status === "unpaid") status = intent?.status === "canceled" || intent?.status === "requires_payment_method" ? "failed" : "pending";
    else throw new StripeError("bad_response", null);
  } else throw new StripeError("bad_response", null);

  const orderId = obj(b.metadata)?.orderId;
  return {
    id: b.id,
    status,
    amountCents: b.amount_total,
    currency: b.currency,
    refundedCents: refunded,
    orderId: typeof orderId === "string" ? orderId : null,
    ...(status === "open" && isStripeCheckoutUrl(b.url) ? { url: b.url } : {}),
  };
}

/** Stripe's form encoding: nested objects and arrays as bracketed keys. */
export function encodeForm(value: Record<string, unknown>): string {
  const params = new URLSearchParams();
  const walk = (v: unknown, key: string) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((item, i) => walk(item, `${key}[${i}]`));
    else if (typeof v === "object") for (const [k, inner] of Object.entries(v)) walk(inner, key ? `${key}[${k}]` : k);
    else params.append(key, String(v));
  };
  walk(value, "");
  return params.toString();
}

export type CheckoutLine = { name: string; unitAmountCents: number; quantity: number };

export type CreateSessionInput = {
  orderId: string;
  lines: CheckoutLine[];
  shipping: { label: string; amountCents: number };
  email: string;
  successUrl: string;
  cancelUrl: string;
  /** Unix seconds. Stripe accepts 30 min to 24 h after creation. */
  expiresAt: number;
  /** Same key = same session at Stripe (double click, retry after a timeout). */
  idempotencyKey: string;
};

export type StripeClient = {
  createCheckoutSession(input: CreateSessionInput): Promise<CheckoutSession>;
  getCheckoutSession(id: string): Promise<CheckoutSession>;
  /** Session that created a PaymentIntent (refund events carry only the PaymentIntent). */
  findSessionIdByPaymentIntent(paymentIntentId: string): Promise<string | null>;
};

const EXPAND = "expand[]=payment_intent.latest_charge";

export function createStripeClient(apiKey: string, fetchImpl: typeof fetch = fetch, timeoutMs = 10_000): StripeClient {
  async function call(path: string, init: { method?: "GET" | "POST"; body?: string; idempotencyKey?: string } = {}): Promise<unknown> {
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
    if (init.body) headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
    let response: Response;
    try {
      response = await fetchImpl(`${STRIPE_API}${path}`, { method: init.method ?? "GET", body: init.body, headers, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new StripeError("network", null);
    }
    if (!response.ok) {
      let detail: StripeErrorDetail | undefined;
      try {
        detail = stripeErrorDetail(await response.json());
      } catch {
        detail = undefined;
      }
      throw new StripeError(categoryFor(response.status), response.status, detail);
    }
    try {
      return await response.json();
    } catch {
      throw new StripeError("bad_response", response.status);
    }
  }

  return {
    async createCheckoutSession(input) {
      const body = encodeForm({
        mode: "payment",
        client_reference_id: input.orderId,
        customer_email: input.email,
        locale: "fr",
        line_items: input.lines.map((l) => ({
          quantity: l.quantity,
          price_data: { currency: "eur", unit_amount: l.unitAmountCents, product_data: { name: l.name } },
        })),
        shipping_options: [
          { shipping_rate_data: { type: "fixed_amount", display_name: input.shipping.label, fixed_amount: { amount: input.shipping.amountCents, currency: "eur" } } },
        ],
        metadata: { orderId: input.orderId },
        payment_intent_data: { metadata: { orderId: input.orderId } },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        expires_at: input.expiresAt,
      });
      const created = obj(await call("/checkout/sessions", { method: "POST", body, idempotencyKey: input.idempotencyKey }));
      // A fresh session has no PaymentIntent to expand yet.
      return parseSession(created);
    },
    async getCheckoutSession(id) {
      if (!isCheckoutSessionId(id)) throw new StripeError("not_found", null);
      return parseSession(await call(`/checkout/sessions/${id}?${EXPAND}`));
    },
    async findSessionIdByPaymentIntent(paymentIntentId) {
      if (!isPaymentIntentId(paymentIntentId)) return null;
      const list = obj(await call(`/checkout/sessions?payment_intent=${paymentIntentId}&limit=1`));
      const first = Array.isArray(list?.data) ? obj(list.data[0]) : null;
      return first && isCheckoutSessionId(first.id) ? first.id : null;
    },
  };
}
