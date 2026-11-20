import { describe, expect, it } from "vitest";
import { StripeError, type StripeCall } from "./stripe-client";
import { createSubscriptionClient, parseInvoice, parseSubscription } from "./stripe-subscriptions";

// Fictitious ids and data only: no real customer, key or account.
type Call = { path: string; method?: string; body?: string; idempotencyKey?: string };

function fakeCall(reply: (c: Call) => unknown) {
  const calls: Call[] = [];
  const call: StripeCall = async (path, init = {}) => {
    const c = { path, ...init };
    calls.push(c);
    return reply(c);
  };
  return { call, calls };
}

const subscription = (over: Record<string, unknown> = {}) => ({
  id: "sub_abc",
  status: "active",
  cancel_at_period_end: false,
  metadata: { uid: "user_1", kind: "mail_club" },
  customer: { id: "cus_abc", shipping: { name: "Client Test", address: { line1: "1 rue Test", line2: null, postal_code: "75000", city: "Paris", country: "FR" } } },
  items: { data: [{ current_period_end: 1_800_000_000, price: { unit_amount: 1195 } }] },
  ...over,
});

describe("parseSubscription", () => {
  it("keeps the fields the shop needs", () => {
    expect(parseSubscription(subscription())).toEqual({
      id: "sub_abc",
      customerId: "cus_abc",
      status: "active",
      uid: "user_1",
      currentPeriodEnd: 1_800_000_000,
      cancelAtPeriodEnd: false,
      priceCents: 1195,
      shipping: { name: "Client Test", line1: "1 rue Test", postalCode: "75000", city: "Paris", country: "FR" },
      livemode: false,
    });
    expect(parseSubscription(subscription({ livemode: true })).livemode).toBe(true);
  });

  it("reads the period on the subscription for older API versions", () => {
    const view = parseSubscription(subscription({ items: { data: [{ price: { unit_amount: 1195 } }] }, current_period_end: 1_700_000_000 }));
    expect(view.currentPeriodEnd).toBe(1_700_000_000);
  });

  it("drops a uid, customer or address that is not well-formed", () => {
    const view = parseSubscription(subscription({ metadata: { uid: "../x" }, customer: "nope", items: { data: [] } }));
    expect(view).toMatchObject({ uid: null, customerId: null, shipping: null, priceCents: null, currentPeriodEnd: null });
  });

  it("rejects a bad id or status", () => {
    expect(() => parseSubscription(subscription({ id: "cus_1" }))).toThrow(StripeError);
    expect(() => parseSubscription(subscription({ status: "weird" }))).toThrow(StripeError);
    expect(() => parseSubscription(null)).toThrow(StripeError);
  });
});

describe("parseInvoice", () => {
  it("reads the subscription in both API shapes", () => {
    const base = { id: "in_1", status: "paid", amount_paid: 1195, status_transitions: { paid_at: 1_800_000_000 } };
    expect(parseInvoice({ ...base, parent: { subscription_details: { subscription: "sub_abc" } } })).toEqual({
      id: "in_1",
      subscriptionId: "sub_abc",
      paid: true,
      amountPaidCents: 1195,
      paidAt: 1_800_000_000,
      livemode: false,
    });
    expect(parseInvoice({ ...base, livemode: true }).livemode).toBe(true);
    expect(parseInvoice({ ...base, subscription: { id: "sub_old" } }).subscriptionId).toBe("sub_old");
    expect(parseInvoice({ ...base, status: "open", amount_paid: 0 })).toMatchObject({ subscriptionId: null, paid: false });
  });

  it("rejects a bad id or amount", () => {
    expect(() => parseInvoice({ id: "sub_1", amount_paid: 0 })).toThrow(StripeError);
    expect(() => parseInvoice({ id: "in_1", amount_paid: -1 })).toThrow(StripeError);
  });
});

describe("createSubscriptionClient", () => {
  const input = {
    uid: "user_1",
    email: "client@example.test",
    productName: "Mail Club test",
    priceCents: 1195,
    shippingCountries: ["FR"],
    successUrl: "https://shop.example.test/mon-compte/abonnement?session={CHECKOUT_SESSION_ID}",
    cancelUrl: "https://shop.example.test/infos/mail-club",
    idempotencyKey: "key-1",
  };

  it("creates a monthly subscription session with the uid in the metadata", async () => {
    const { call, calls } = fakeCall(() => ({ id: "cs_test_abc", url: "https://checkout.stripe.com/c/pay/cs_test_abc" }));
    const session = await createSubscriptionClient(call).createSubscriptionCheckout(input);
    expect(session).toEqual({ id: "cs_test_abc", url: "https://checkout.stripe.com/c/pay/cs_test_abc" });
    expect(calls[0]).toMatchObject({ path: "/checkout/sessions", method: "POST", idempotencyKey: "key-1" });
    const body = new URLSearchParams(calls[0].body);
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("client_reference_id")).toBe("user_1");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("1195");
    expect(body.get("line_items[0][price_data][currency]")).toBe("eur");
    expect(body.get("line_items[0][price_data][recurring][interval]")).toBe("month");
    expect(body.get("shipping_address_collection[allowed_countries][0]")).toBe("FR");
    expect(body.get("subscription_data[metadata][uid]")).toBe("user_1");
    expect(body.get("metadata[kind]")).toBe("mail_club");
  });

  it("refuses a bad uid and a response that is not a Stripe Checkout page", async () => {
    const { call } = fakeCall(() => ({ id: "cs_test_abc", url: "https://evil.example/pay" }));
    const client = createSubscriptionClient(call);
    await expect(client.createSubscriptionCheckout({ ...input, uid: "a/b" })).rejects.toThrow(StripeError);
    await expect(client.createSubscriptionCheckout(input)).rejects.toThrow(StripeError);
  });

  it("reads back a subscription session and refuses a payment session", async () => {
    const { call } = fakeCall((c) =>
      c.path.endsWith("cs_test_pay")
        ? { id: "cs_test_pay", mode: "payment" }
        : { id: "cs_test_sub", mode: "subscription", status: "complete", client_reference_id: "user_1", subscription: "sub_abc" },
    );
    const client = createSubscriptionClient(call);
    expect(await client.getSubscriptionCheckout("cs_test_sub")).toEqual({ id: "cs_test_sub", uid: "user_1", subscriptionId: "sub_abc", complete: true });
    await expect(client.getSubscriptionCheckout("cs_test_pay")).rejects.toThrow(StripeError);
    await expect(client.getSubscriptionCheckout("../x")).rejects.toThrow(StripeError);
  });

  it("expands the customer and cancels at the end of the period", async () => {
    const { call, calls } = fakeCall(() => subscription({ cancel_at_period_end: true }));
    const client = createSubscriptionClient(call);
    await client.getSubscription("sub_abc");
    expect(calls[0].path).toBe("/subscriptions/sub_abc?expand[]=customer");
    const view = await client.cancelAtPeriodEnd("sub_abc", "cancel-key");
    expect(view.cancelAtPeriodEnd).toBe(true);
    expect(calls[1]).toMatchObject({ path: "/subscriptions/sub_abc", method: "POST", idempotencyKey: "cancel-key" });
    expect(new URLSearchParams(calls[1].body).get("cancel_at_period_end")).toBe("true");
    await expect(client.getSubscription("cus_1")).rejects.toThrow(StripeError);
    await expect(client.getInvoice("sub_1")).rejects.toThrow(StripeError);
  });
});
