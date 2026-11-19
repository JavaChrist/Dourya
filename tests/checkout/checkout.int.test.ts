import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminDb } from "@/lib/firebase/admin-db";
import { placeOrder, refreshOrderState } from "@/lib/checkout/service";
import { getOrder, listOrderEvents } from "@/lib/orders/repository";
import { StripeError } from "@/lib/payments/stripe-client";
import { completed, deps, event, fakeStripe, nowSec, onlyOrderId, order, ORIGIN, product, settings, stock, T0, webhook } from "./fixtures";

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

describe("placeOrder", () => {
  it("creates the order, holds the stock and sends the customer to Stripe", async () => {
    const stripe = fakeStripe();
    const res = await placeOrder(order(), deps(stripe));
    expect(res).toEqual({ kind: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_fake1" });
    const id = await onlyOrderId();
    expect(await getOrder(id)).toMatchObject({ paymentStatus: "awaiting_payment", paymentRef: "cs_test_fake1", totalCents: 1200, shippingCents: 200 });
    expect(await stock()).toMatchObject({ stock: 1, reserved: 1 });
    // Server prices, shipping as its own option, no payment_method_types (dashboard), at least 30 minutes.
    const sent = stripe.created[0];
    expect(sent).toMatchObject({ orderId: id, lines: [{ unitAmountCents: 1000, quantity: 1 }], shipping: { amountCents: 200 } });
    expect(sent).not.toHaveProperty("methods");
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

  it("lost Stripe response, retry of the same attempt in another 5-minute slot: one session only", async () => {
    const stripe = fakeStripe();
    // The session is created at Stripe, but the response is lost: the order stays a draft without paymentRef.
    stripe.loseNextResponse();
    expect(await placeOrder(order(), deps(stripe))).toMatchObject({ code: "payment_error" });
    const id = await onlyOrderId();
    expect(await getOrder(id)).toMatchObject({ paymentStatus: "draft" });
    expect(stripe.created).toHaveLength(1);

    // Same tab, same attempt, 6 minutes later: the saved request is replayed as is.
    const later = new Date(T0.getTime() + 6 * 60_000);
    stripe.setNow(later);
    const res = await placeOrder(order(), deps(stripe, { now: later }));
    expect(res).toEqual({ kind: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_fake1" });
    expect(stripe.created).toHaveLength(1);
    expect(await onlyOrderId()).toBe(id);
    expect(await getOrder(id)).toMatchObject({ paymentStatus: "awaiting_payment", paymentRef: "cs_test_fake1" });
    expect(await stock()).toMatchObject({ reserved: 1 });
    // Replayed value for value: same key, same expires_at, same parameters.
    expect(await adminDb().collection("orders").doc(id).get().then((d) => d.get("paymentRequest.idempotencyKey"))).toBe(`attempt-aaaaaaaaaaaa-${id}`);
  });

  it("lost Stripe response, two concurrent retries: same saved request, one session, one hold", async () => {
    const stripe = fakeStripe();
    stripe.loseNextResponse();
    expect(await placeOrder(order(), deps(stripe))).toMatchObject({ code: "payment_error" });
    const id = await onlyOrderId();

    const later = new Date(T0.getTime() + 6 * 60_000);
    stripe.setNow(later);
    const [a, b] = await Promise.all([placeOrder(order(), deps(stripe, { now: later })), placeOrder(order(), deps(stripe, { now: later }))]);
    expect(a).toEqual({ kind: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_fake1" });
    expect(b).toEqual(a);
    expect(stripe.created).toHaveLength(1);
    expect(stripe.sessions.size).toBe(1);
    expect(await onlyOrderId()).toBe(id);
    expect(await getOrder(id)).toMatchObject({ paymentStatus: "awaiting_payment", paymentRef: "cs_test_fake1" });
    expect(await stock()).toMatchObject({ stock: 1, reserved: 1 });
  });

  it("lost Stripe response, session paid meanwhile: the retry attaches it and records the payment", async () => {
    const stripe = fakeStripe();
    stripe.loseNextResponse();
    expect(await placeOrder(order(), deps(stripe))).toMatchObject({ code: "payment_error" });
    const id = await onlyOrderId();
    // The customer paid on the session whose creation response we never got
    // (Stripe would still replay that original "open" response for the key).
    stripe.set("cs_test_fake1", { status: "paid" });

    const later = new Date(T0.getTime() + 6 * 60_000);
    stripe.setNow(later);
    const res = await placeOrder(order(), deps(stripe, { now: later }));
    expect(res).toEqual({ kind: "redirect", url: `${ORIGIN}/commande/retour?commande=${id}` });
    expect(stripe.created).toHaveLength(1);
    expect(stripe.sessions.size).toBe(1);
    expect(await onlyOrderId()).toBe(id);
    expect(await getOrder(id)).toMatchObject({ paymentStatus: "paid", paymentRef: "cs_test_fake1", stockState: "committed" });
    // Sold once, no second hold.
    expect(await stock()).toMatchObject({ stock: 0, reserved: 0 });
    // A later click, the webhook and the return page change nothing more.
    expect(await placeOrder(order(), deps(stripe, { now: later }))).toEqual(res);
    expect(await webhook(stripe, completed())).toBe(200);
    expect(await refreshOrderState(id, stripe.access, later)).toBe("paid");
    expect(await stock()).toMatchObject({ stock: 0, reserved: 0 });
    expect(stripe.created).toHaveLength(1);
  });

  it("lost Stripe response, paid, the customer never comes back: the webhook attaches the session", async () => {
    const stripe = fakeStripe();
    stripe.loseNextResponse();
    expect(await placeOrder(order(), deps(stripe))).toMatchObject({ code: "payment_error" });
    const id = await onlyOrderId();
    stripe.set("cs_test_fake1", { status: "paid" });
    expect(await webhook(stripe, completed())).toBe(200);
    expect(await getOrder(id)).toMatchObject({ paymentStatus: "paid", paymentRef: "cs_test_fake1", stockState: "committed" });
    expect((await getOrder(id))?.needsReview).toBeUndefined();
    expect(await stock()).toMatchObject({ stock: 0, reserved: 0 });
  });

  it("same tab after the hold expired: the stale attempt gets a new order and a single hold", async () => {
    const stripe = fakeStripe();
    stripe.fail(new StripeError("invalid_request", 400));
    expect(await placeOrder(order(), deps(stripe))).toMatchObject({ code: "payment_error" });
    const first = await onlyOrderId();
    expect(await stock()).toMatchObject({ reserved: 1 });

    // 31 minutes later: the hold has expired but not the saved expires_at.
    // Stripe refuses the replayed date, which alone proves nothing: the draft,
    // its hold and its key stay, no new session or order.
    const soon = new Date(T0.getTime() + 31 * 60_000);
    stripe.setNow(soon);
    expect(await placeOrder(order(), deps(stripe, { now: soon }))).toMatchObject({ code: "payment_error" });
    expect(await onlyOrderId()).toBe(first);
    expect((await getOrder(first))?.paymentStatus).toBe("draft");
    expect(stripe.created).toHaveLength(0);
    expect(await stock()).toMatchObject({ reserved: 1 });

    // Once expires_at has passed, the identical replay is refused again within
    // Stripe's key window: no session can exist. The sweep cancels the old
    // draft, the attempt is stale, a new order (new key) is created.
    const later = new Date(T0.getTime() + 36 * 60_000);
    stripe.setNow(later);
    const res = await placeOrder(order(), deps(stripe, { now: later }));
    expect(res).toMatchObject({ kind: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_fake1" });
    expect((await getOrder(first))?.paymentStatus).toBe("cancelled");
    const all = await adminDb().collection("orders").get();
    expect(all.size).toBe(2);
    const second = all.docs.find((d) => d.id !== first)!;
    expect(second.get("paymentStatus")).toBe("awaiting_payment");
    expect(stripe.created).toHaveLength(1);
    expect(stripe.created.at(-1)?.orderId).toBe(second.id);
    // Stock 1: the new hold fits only because the old one was released.
    expect(await stock()).toMatchObject({ stock: 1, reserved: 1 });
    // A double click now returns the new order, not a third one.
    expect(await placeOrder(order(), deps(stripe, { now: later }))).toEqual(res);
    expect((await adminDb().collection("orders").get()).size).toBe(2);
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
