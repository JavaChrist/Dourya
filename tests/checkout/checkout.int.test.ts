import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminDb } from "@/lib/firebase/admin-db";
import { handleStripeWebhook, placeOrder, refreshOrderState, type PlaceOrderDeps, type PlaceOrderInput } from "@/lib/checkout/service";
import { getOrder, listOrderEvents } from "@/lib/orders/repository";
import type { StripeAccess } from "@/lib/payments/stripe";
import { StripeError, type CheckoutSession, type CreateSessionInput, type StripeClient } from "@/lib/payments/stripe-client";
import type { ShippingSettings } from "@/lib/shipping/types";
import type { Product } from "@/lib/types";

// Checkout stays closed in the real config: opened here only, for the tests.
vi.mock("@/config/commerce", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/commerce")>();
  return { ...actual, commerceConfig: { ...actual.commerceConfig, checkoutEnabled: true } };
});

// Fictitious data only, on the emulators: no real customer, product, price or rate.
const host = () => process.env.FIRESTORE_EMULATOR_HOST;
beforeEach(async () => {
  await fetch(`http://${host()}/emulator/v1/projects/demo-dourya/databases/(default)/documents`, { method: "DELETE" });
});

const T0 = new Date("2026-01-10T10:00:00Z");
const ORIGIN = "https://shop.example.test";

const product = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  slug: "produit-test",
  name: "Produit test",
  description: "",
  status: "published",
  categorySlugs: [],
  collectionSlugs: [],
  images: [],
  variants: [
    { id: "v1", sku: "TEST-1", name: "A5", attributes: [], priceCents: 1000, weightGrams: 20, packedDimensionsMm: { length: 210, width: 148, height: 2 }, stockMode: "stocked", stock: 1, active: true },
  ],
  isDemo: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const settings = (rates = true): ShippingSettings => ({
  zones: [{ code: "FR", name: "France", enabled: true }],
  rates: rates
    ? [{ id: "test-rate", enabled: true, zone: "FR", envelope: "standard", service: "letter", label: "Tarif test", priceCents: 200, packagingWeightGrams: 10, maxWeightGrams: 100, maxThicknessMm: 20, maxLengthMm: 300, maxWidthMm: 250, freeShippingEligible: false }]
    : [],
  freeShippingThresholdCents: null,
});

/** In-memory Stripe: one Checkout Session per idempotency key, states changed by the test. */
function fakeStripe(mode: "test" | "live" = "test") {
  const sessions = new Map<string, CheckoutSession>();
  const byKey = new Map<string, string>();
  const created: CreateSessionInput[] = [];
  let failNext: StripeError | null = null;
  const takeFailure = () => {
    if (failNext) {
      const e = failNext;
      failNext = null;
      throw e;
    }
  };
  const client: StripeClient = {
    async createCheckoutSession(input) {
      takeFailure();
      const existing = byKey.get(input.idempotencyKey);
      if (existing) return sessions.get(existing)!;
      created.push(input);
      const id = `cs_test_fake${sessions.size + 1}`;
      const amountCents = input.lines.reduce((sum, l) => sum + l.unitAmountCents * l.quantity, 0) + input.shipping.amountCents;
      const session: CheckoutSession = { id, status: "open", amountCents, currency: "eur", refundedCents: 0, orderId: input.orderId, url: `https://checkout.stripe.com/c/pay/${id}` };
      sessions.set(id, session);
      byKey.set(input.idempotencyKey, id);
      return session;
    },
    async getCheckoutSession(id) {
      takeFailure();
      const s = sessions.get(id);
      if (!s) throw new StripeError("not_found", 404);
      return s;
    },
    async findSessionIdByPaymentIntent(pi) {
      takeFailure();
      return pi === "pi_fake1" && sessions.has("cs_test_fake1") ? "cs_test_fake1" : null;
    },
  };
  const set = (id: string, over: Partial<CheckoutSession>) => {
    const s = sessions.get(id)!;
    const next = { ...s, ...over };
    if (next.status !== "open") delete next.url;
    sessions.set(id, next);
  };
  return { access: { client, mode } satisfies StripeAccess, sessions, created, set, fail: (e: StripeError) => (failNext = e) };
}

// Fictitious webhook secret and signed events, as Stripe would send them.
const SECRET = `whsec_${"t".repeat(24)}`;
const nowSec = Math.floor(T0.getTime() / 1000);
function event(type: string, object: Record<string, unknown>, secret = SECRET) {
  const raw = JSON.stringify({ id: "evt_test", type, data: { object } });
  const sig = `t=${nowSec},v1=${createHmac("sha256", secret).update(`${nowSec}.${raw}`).digest("hex")}`;
  return { raw, sig };
}
const webhook = (stripe: ReturnType<typeof fakeStripe> | null, e: { raw: string; sig: string }, secret: string | null = SECRET) =>
  handleStripeWebhook(e.raw, e.sig, stripe?.access ?? null, secret, T0);
const completed = (id = "cs_test_fake1") => event("checkout.session.completed", { id });

const order = (over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  attemptKey: "attempt-aaaaaaaaaaaa",
  items: [{ productId: "p1", variantId: "v1", quantity: 1 }],
  email: "client@example.test",
  address: { fullName: "Client Test", line1: "1 rue Test", postalCode: "75000", city: "Paris", country: "FR" },
  rateId: "test-rate",
  acceptTerms: true,
  expectedTotalCents: 1200,
  ...over,
});

const deps = (stripe: ReturnType<typeof fakeStripe>, over: Partial<PlaceOrderDeps> = {}): PlaceOrderDeps => ({
  stripe: stripe.access,
  products: [product()],
  settings: settings(),
  customer: null,
  origin: ORIGIN,
  now: T0,
  ...over,
});

const stock = async () => (await adminDb().collection("inventory").doc("p1__v1").get()).data();
const onlyOrderId = async () => {
  const snap = await adminDb().collection("orders").get();
  expect(snap.size).toBe(1);
  return snap.docs[0].id;
};

describe("placeOrder", () => {
  it("creates the order, holds the stock and sends the customer to Stripe", async () => {
    const stripe = fakeStripe();
    const res = await placeOrder(order(), deps(stripe));
    expect(res).toEqual({ kind: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_fake1" });
    const id = await onlyOrderId();
    expect(await getOrder(id)).toMatchObject({ paymentStatus: "awaiting_payment", paymentRef: "cs_test_fake1", totalCents: 1200, shippingCents: 200 });
    expect(await stock()).toMatchObject({ stock: 1, reserved: 1 });
    // Server prices, shipping as its own option, card only, at least 30 minutes.
    const sent = stripe.created[0];
    expect(sent).toMatchObject({ orderId: id, lines: [{ unitAmountCents: 1000, quantity: 1 }], shipping: { amountCents: 200 }, methods: ["card"] });
    expect(sent.expiresAt - nowSec).toBeGreaterThanOrEqual(30 * 60);
    expect(sent.cancelUrl).toBe(`${ORIGIN}/commande`);
  });

  it("double click: one order, one session, same checkout page", async () => {
    const stripe = fakeStripe();
    const [a, b] = await Promise.all([placeOrder(order(), deps(stripe)), placeOrder(order(), deps(stripe))]);
    expect(a).toEqual(b);
    await onlyOrderId();
    expect(stripe.sessions.size).toBe(1);
    // A third click later still lands on the open session.
    expect(await placeOrder(order(), deps(stripe))).toEqual(a);
  });

  it("modified cart: the old attempt key is refused, a new one works", async () => {
    const stripe = fakeStripe();
    const products = [product({ variants: [{ ...product().variants[0], stock: 5 }] })];
    await placeOrder(order(), deps(stripe, { products }));
    const changed = order({ items: [{ productId: "p1", variantId: "v1", quantity: 2 }], expectedTotalCents: 2200 });
    expect(await placeOrder(changed, deps(stripe, { products }))).toMatchObject({ kind: "error", code: "attempt_conflict", resetAttempt: true });
    expect(await placeOrder({ ...changed, attemptKey: "attempt-bbbbbbbbbbbb" }, deps(stripe, { products }))).toMatchObject({ kind: "redirect" });
  });

  it("a total that differs from the one shown is refused", async () => {
    expect(await placeOrder(order({ expectedTotalCents: 1000 }), deps(fakeStripe()))).toMatchObject({ kind: "error", code: "total_changed" });
    expect((await adminDb().collection("orders").get()).size).toBe(0);
  });

  it("unavailable shipping and missing terms block the order", async () => {
    expect(await placeOrder(order(), deps(fakeStripe(), { settings: settings(false) }))).toMatchObject({ code: "shipping_unavailable" });
    const res = await placeOrder(order({ acceptTerms: false, email: "nope" }), deps(fakeStripe()));
    expect(res).toMatchObject({ code: "invalid_form" });
    expect(Object.keys((res as { fieldErrors: object }).fieldErrors).sort()).toEqual(["acceptTerms", "email"]);
  });

  it("gate: demo products, live key and missing key", async () => {
    expect(await placeOrder(order(), deps(fakeStripe(), { products: [product({ isDemo: true })] }))).toMatchObject({ code: "demo_products" });
    expect(await placeOrder(order(), deps(fakeStripe("live")))).toMatchObject({ code: "live_refused" });
    expect(await placeOrder(order(), { ...deps(fakeStripe()), stripe: null })).toMatchObject({ code: "payment_not_configured" });
    expect((await adminDb().collection("orders").get()).size).toBe(0);
  });

  it("Stripe down: the draft stays and a retry with the same key reuses it", async () => {
    const stripe = fakeStripe();
    stripe.fail(new StripeError("unavailable", 503));
    expect(await placeOrder(order(), deps(stripe))).toMatchObject({ code: "payment_error" });
    const id = await onlyOrderId();
    expect((await getOrder(id))?.paymentStatus).toBe("draft");
    expect(await placeOrder(order(), deps(stripe))).toMatchObject({ kind: "redirect" });
    expect(await onlyOrderId()).toBe(id);
    expect((await getOrder(id))?.paymentStatus).toBe("awaiting_payment");
  });
});

describe("webhook and return page", () => {
  async function placed() {
    const stripe = fakeStripe();
    await placeOrder(order(), deps(stripe));
    return { stripe, id: await onlyOrderId() };
  }

  it("paid: applied once, a repeated event changes nothing", async () => {
    const { stripe, id } = await placed();
    expect(await refreshOrderState(id, stripe.access, T0)).toBe("pending");
    stripe.set("cs_test_fake1", { status: "paid" });
    expect(await webhook(stripe, completed())).toBe(200);
    expect(await webhook(stripe, completed())).toBe(200);
    expect(await refreshOrderState(id, stripe.access, T0)).toBe("paid");
    const paid = (await listOrderEvents(id)).filter((e) => e.type === "payment_status" && e.to === "paid");
    expect(paid).toHaveLength(1);
    expect(await stock()).toMatchObject({ stock: 0, reserved: 0 });
  });

  it("the event body is never trusted: the session is re-read at Stripe", async () => {
    const { stripe, id } = await placed();
    // A signed "completed" event while the session is still unpaid at Stripe changes nothing.
    expect(await webhook(stripe, completed())).toBe(200);
    expect((await getOrder(id))?.paymentStatus).toBe("awaiting_payment");
  });

  it("return page before the webhook: re-reads Stripe itself", async () => {
    const { stripe, id } = await placed();
    stripe.set("cs_test_fake1", { status: "paid" });
    expect(await refreshOrderState(id, stripe.access, T0)).toBe("paid");
    // The late webhook then finds nothing to do.
    expect(await webhook(stripe, completed())).toBe(200);
    expect((await listOrderEvents(id)).filter((e) => e.to === "paid")).toHaveLength(1);
  });

  it("failure and expiry release the stock", async () => {
    const { stripe, id } = await placed();
    stripe.set("cs_test_fake1", { status: "failed" });
    expect(await webhook(stripe, event("checkout.session.async_payment_failed", { id: "cs_test_fake1" }))).toBe(200);
    expect(await refreshOrderState(id, stripe.access, T0)).toBe("failed");
    expect(await stock()).toMatchObject({ reserved: 0 });

    const other = fakeStripe();
    await placeOrder(order({ attemptKey: "attempt-cccccccccccc" }), deps(other));
    const second = (await adminDb().collection("orders").where("attemptKey", "==", "attempt-cccccccccccc").get()).docs[0].id;
    other.set("cs_test_fake1", { status: "expired" });
    expect(await webhook(other, event("checkout.session.expired", { id: "cs_test_fake1" }))).toBe(200);
    expect(await refreshOrderState(second, other.access, T0)).toBe("expired");
  });

  it("refund: found through the PaymentIntent, amount re-read at Stripe", async () => {
    const { stripe, id } = await placed();
    stripe.set("cs_test_fake1", { status: "paid" });
    await webhook(stripe, completed());
    stripe.set("cs_test_fake1", { refundedCents: 1200 });
    expect(await webhook(stripe, event("charge.refunded", { id: "ch_test", payment_intent: "pi_fake1" }))).toBe(200);
    expect(await refreshOrderState(id, stripe.access, T0)).toBe("refunded");
  });

  it("bad signature, unknown or unconfigured: no change, Stripe retries only on outage", async () => {
    const { stripe, id } = await placed();
    stripe.set("cs_test_fake1", { status: "paid" });
    // Forged: signed with another secret, or tampered after signing.
    expect(await webhook(stripe, completed(), `whsec_${"o".repeat(24)}`)).toBe(400);
    const e = completed();
    expect(await webhook(stripe, { raw: e.raw.replace("cs_test_fake1", "cs_test_fake2"), sig: e.sig })).toBe(400);
    expect((await getOrder(id))?.paymentStatus).toBe("awaiting_payment");

    expect(await webhook(stripe, completed("cs_test_unknown"))).toBe(200);
    expect(await webhook(stripe, event("customer.created", { id: "cus_test" }))).toBe(200);
    expect(await webhook(null, completed())).toBe(503);
    expect(await webhook(stripe, completed(), null)).toBe(503);
    stripe.fail(new StripeError("unavailable", 502));
    expect(await webhook(stripe, completed())).toBe(500);
    expect(await refreshOrderState("does-not-exist", stripe.access, T0)).toBe("unknown");
  });
});
