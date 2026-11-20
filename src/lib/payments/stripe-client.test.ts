import { describe, expect, it, vi } from "vitest";
import { STRIPE_API, acceptedKeyMode, StripeError, createStripeClient, encodeForm, isStripeCheckoutUrl, parseSession, stripeErrorDetail, stripeKeyMode } from "./stripe-client";

// Fictitious key and ids: never a real Stripe value.
const KEY = `sk_test_${"x".repeat(24)}`;

const session = (over: Record<string, unknown> = {}) => ({
  id: "cs_test_abc",
  object: "checkout.session",
  status: "open",
  payment_status: "unpaid",
  amount_total: 1200,
  currency: "eur",
  metadata: { orderId: "ord_1" },
  url: "https://checkout.stripe.com/c/pay/cs_test_abc",
  payment_intent: null,
  ...over,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("stripeKeyMode", () => {
  it("reads test or live from the prefix, rejects anything else", () => {
    expect(stripeKeyMode(KEY)).toBe("test");
    expect(stripeKeyMode(`sk_live_${"x".repeat(24)}`)).toBe("live");
    expect(stripeKeyMode(`rk_test_${"x".repeat(24)}`)).toBe("test");
    expect(stripeKeyMode(`pk_test_${"x".repeat(24)}`)).toBeNull();
    expect(stripeKeyMode("sk_test_short")).toBeNull();
    expect(stripeKeyMode(undefined)).toBeNull();
  });
});

describe("acceptedKeyMode", () => {
  it("accepts a live key only on the production deployment", () => {
    expect(acceptedKeyMode("live", "production")).toBe("live");
    expect(acceptedKeyMode("live", "preview")).toBeNull();
    expect(acceptedKeyMode("live", "development")).toBeNull();
    expect(acceptedKeyMode("live", undefined)).toBeNull();
  });
  it("accepts a test key everywhere and keeps a missing key missing", () => {
    expect(acceptedKeyMode("test", "production")).toBe("test");
    expect(acceptedKeyMode("test", undefined)).toBe("test");
    expect(acceptedKeyMode(null, "production")).toBeNull();
  });
});

describe("isStripeCheckoutUrl", () => {
  it("accepts only https pages on checkout.stripe.com", () => {
    expect(isStripeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_abc")).toBe(true);
    expect(isStripeCheckoutUrl("http://checkout.stripe.com/c/pay")).toBe(false);
    expect(isStripeCheckoutUrl("https://checkout.stripe.com.evil.test/")).toBe(false);
    expect(isStripeCheckoutUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("parseSession", () => {
  it("maps open, expired, paid and keeps the url only while open", () => {
    expect(parseSession(session())).toEqual({ id: "cs_test_abc", status: "open", amountCents: 1200, currency: "eur", refundedCents: 0, orderId: "ord_1", url: "https://checkout.stripe.com/c/pay/cs_test_abc" });
    expect(parseSession(session({ status: "expired", url: null }))).toMatchObject({ status: "expired" });
    expect(parseSession(session({ status: "complete", payment_status: "paid" }))).not.toHaveProperty("url");
  });

  it("complete but unpaid: pending while processing, failed when the PaymentIntent gave up", () => {
    const processing = { status: "processing", latest_charge: null };
    expect(parseSession(session({ status: "complete", payment_intent: processing })).status).toBe("pending");
    expect(parseSession(session({ status: "complete", payment_intent: { status: "requires_payment_method" } })).status).toBe("failed");
    expect(parseSession(session({ status: "complete", payment_intent: { status: "canceled" } })).status).toBe("failed");
  });

  it("reads the refunded amount from the expanded charge", () => {
    const refunded = session({ status: "complete", payment_status: "paid", payment_intent: { status: "succeeded", latest_charge: { amount_refunded: 500 } } });
    expect(parseSession(refunded)).toMatchObject({ status: "paid", refundedCents: 500 });
  });

  it("rejects malformed bodies", () => {
    expect(() => parseSession(null)).toThrow(StripeError);
    expect(() => parseSession(session({ id: "tr_x" }))).toThrow(StripeError);
    expect(() => parseSession(session({ amount_total: 12.5 }))).toThrow(StripeError);
    expect(() => parseSession(session({ status: "weird" }))).toThrow(StripeError);
  });

  it("a session without metadata has no order", () => {
    expect(parseSession(session({ metadata: {} })).orderId).toBeNull();
  });
});

describe("encodeForm", () => {
  it("uses Stripe's bracket notation", () => {
    const body = new URLSearchParams(encodeForm({ a: 1, list: ["card"], nested: { x: { y: "z" } }, skip: undefined }));
    expect(Object.fromEntries(body)).toEqual({ a: "1", "list[0]": "card", "nested[x][y]": "z" });
  });
});

describe("createStripeClient", () => {
  const input = {
    orderId: "ord_1",
    lines: [{ name: "Produit test", unitAmountCents: 1000, quantity: 1 }],
    shipping: { label: "Tarif test", amountCents: 200 },
    email: "client@example.test",
    successUrl: "https://shop.example.test/commande/retour?commande=ord_1",
    cancelUrl: "https://shop.example.test/commande",
    expiresAt: 1_800_000_000,
    idempotencyKey: "attempt-aaaaaaaaaaaa",
  };

  it("creates a hosted session with server lines, shipping, metadata and the idempotency key", async () => {
    const fetchImpl = vi.fn(async () => json(session()));
    const result = await createStripeClient(KEY, fetchImpl as unknown as typeof fetch).createCheckoutSession(input);
    expect(result.url).toBe("https://checkout.stripe.com/c/pay/cs_test_abc");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${STRIPE_API}/checkout/sessions`);
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("attempt-aaaaaaaaaaaa");
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    const form = Object.fromEntries(new URLSearchParams(String(init.body)));
    // Stripe refuses payment_method_types: methods come from the dashboard.
    expect(Object.keys(form).some((k) => k.startsWith("payment_method_types"))).toBe(false);
    expect(form).toMatchObject({
      mode: "payment",
      client_reference_id: "ord_1",
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": "1000",
      "line_items[0][quantity]": "1",
      "shipping_options[0][shipping_rate_data][fixed_amount][amount]": "200",
      "metadata[orderId]": "ord_1",
      "payment_intent_data[metadata][orderId]": "ord_1",
      expires_at: "1800000000",
    });
  });

  it("re-reads a session with the charge expanded", async () => {
    const fetchImpl = vi.fn(async () => json(session()));
    await createStripeClient(KEY, fetchImpl as unknown as typeof fetch).getCheckoutSession("cs_test_abc");
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(`${STRIPE_API}/checkout/sessions/cs_test_abc?expand[]=payment_intent.latest_charge`);
  });

  it("never calls Stripe with a malformed id", async () => {
    const fetchImpl = vi.fn();
    const client = createStripeClient(KEY, fetchImpl as unknown as typeof fetch);
    await expect(client.getCheckoutSession("../x")).rejects.toMatchObject({ category: "not_found" });
    expect(await client.findSessionIdByPaymentIntent("nope")).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("finds the session of a PaymentIntent", async () => {
    const fetchImpl = vi.fn(async () => json({ data: [{ id: "cs_test_abc" }] }));
    expect(await createStripeClient(KEY, fetchImpl as unknown as typeof fetch).findSessionIdByPaymentIntent("pi_123")).toBe("cs_test_abc");
  });

  it("maps HTTP and network errors to categories, never the raw message", async () => {
    const cases: [number, string][] = [
      [404, "not_found"],
      [401, "unauthorized"],
      [400, "invalid_request"],
      [409, "idempotency"],
      [429, "rate_limited"],
      [503, "unavailable"],
    ];
    for (const [status, category] of cases) {
      const client = createStripeClient(KEY, (async () => json({ error: { message: "secret detail" } }, status)) as unknown as typeof fetch);
      const error = await client.getCheckoutSession("cs_test_abc").catch((e: unknown) => e);
      expect(error).toMatchObject({ category, status });
      expect(String((error as Error).message)).not.toContain("secret detail");
    }
    const offline = createStripeClient(KEY, (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch);
    await expect(offline.getCheckoutSession("cs_test_abc")).rejects.toMatchObject({ category: "network" });
  });

  it("keeps Stripe error type/code/param identifiers, never the message or a value", async () => {
    const body = { error: { type: "invalid_request_error", code: "email_invalid", param: "customer_email", message: "Invalid email: someone@example.test" } };
    const client = createStripeClient(KEY, (async () => json(body, 400)) as unknown as typeof fetch);
    const error = (await client.getCheckoutSession("cs_test_abc").catch((e: unknown) => e)) as StripeError;
    expect(error.detail).toEqual({ type: "invalid_request_error", code: "email_invalid", param: "customer_email" });
    expect(JSON.stringify(error.detail)).not.toContain("example.test");
  });
});

describe("stripeErrorDetail", () => {
  it("drops fields that are not plain identifiers", () => {
    expect(stripeErrorDetail({ error: { type: "invalid_request_error", code: "a b <x>", param: "x".repeat(200) } })).toEqual({ type: "invalid_request_error", code: undefined, param: undefined });
    expect(stripeErrorDetail({ error: "nope" })).toBeUndefined();
    expect(stripeErrorDetail(null)).toBeUndefined();
  });

  it("maps the missing account name message to a fixed label", () => {
    const detail = stripeErrorDetail({ error: { type: "invalid_request_error", message: "In order to use Checkout, you must set an account or business name at https://dashboard.stripe.com/account." } });
    expect(detail).toEqual({ type: "invalid_request_error", code: "account_name_missing", param: undefined });
  });
});
