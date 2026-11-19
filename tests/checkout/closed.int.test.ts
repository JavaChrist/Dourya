import { beforeEach, describe, expect, it } from "vitest";
import { adminDb } from "@/lib/firebase/admin-db";
import { placeOrder, refreshOrderState } from "@/lib/checkout/service";
import { checkoutSwitch } from "@/lib/checkout/test-preview";
import { getOrder, listOrderEvents } from "@/lib/orders/repository";
import { completed, deps, event, fakeStripe, onlyOrderId, order, stock, T0, webhook } from "./fixtures";

/**
 * Checkout closed, with the REAL config (commerceConfig.checkoutEnabled =
 * false, no mock in this file): no new Stripe session can be created, but the
 * webhook keeps applying payments already started and refunds.
 * Fictitious data only, on the emulators.
 */

const host = () => process.env.FIRESTORE_EMULATOR_HOST;
beforeEach(async () => {
  await fetch(`http://${host()}/emulator/v1/projects/demo-dourya/databases/(default)/documents`, { method: "DELETE" });
});

const production = { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" };
/** The window before the closure: an order whose payment was started while checkout was open. */
const OPEN = { checkoutEnabled: true, allowDemoCheckoutInTestMode: false };

const orderCount = async () => (await adminDb().collection("orders").get()).size;

describe("checkout closed: no new Stripe session", () => {
  it("config values, production + live key, other previews: refused before Stripe is called", async () => {
    const live = fakeStripe("live");
    const test = fakeStripe("test");
    const cases = [
      placeOrder(order(), deps(test)),
      placeOrder(order(), deps(live, { checkout: checkoutSwitch(production, "live") })),
      placeOrder(order(), deps(test, { checkout: checkoutSwitch(production, "test") })),
      placeOrder(order(), deps(test, { checkout: checkoutSwitch({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature-x", CHECKOUT_ENABLED: "true" }, "test") })),
    ];
    for (const result of await Promise.all(cases)) expect(result).toMatchObject({ kind: "error", code: "checkout_closed" });
    expect(live.created).toHaveLength(0);
    expect(test.created).toHaveLength(0);
    expect(await orderCount()).toBe(0);
    expect((await stock())?.reserved ?? 0).toBe(0);
  });
});

describe("checkout closed: the webhook still settles what was started", () => {
  async function startedThenClosed() {
    const stripe = fakeStripe();
    expect(await placeOrder(order(), deps(stripe, { checkout: OPEN }))).toMatchObject({ kind: "redirect" });
    const id = await onlyOrderId();
    // Closure: a new attempt is refused and creates no session.
    expect(await placeOrder(order({ attemptKey: "attempt-dddddddddddd" }), deps(stripe))).toMatchObject({ code: "checkout_closed" });
    expect(stripe.created).toHaveLength(1);
    expect(await orderCount()).toBe(1);
    return { stripe, id };
  }

  it("paid, then refunded: both applied while checkout is closed", async () => {
    const { stripe, id } = await startedThenClosed();
    stripe.set("cs_test_fake1", { status: "paid" });
    expect(await webhook(stripe, completed())).toBe(200);
    expect((await getOrder(id))?.paymentStatus).toBe("paid");
    expect(await stock()).toMatchObject({ stock: 0, reserved: 0 });

    stripe.set("cs_test_fake1", { refundedCents: 1200 });
    expect(await webhook(stripe, event("charge.refunded", { id: "ch_test", payment_intent: "pi_fake1" }))).toBe(200);
    expect((await getOrder(id))?.paymentStatus).toBe("refunded");
    expect(await refreshOrderState(id, stripe.access, T0)).toBe("refunded");
  });

  it("delayed payment succeeded: applied while checkout is closed", async () => {
    const { stripe, id } = await startedThenClosed();
    stripe.set("cs_test_fake1", { status: "paid" });
    expect(await webhook(stripe, event("checkout.session.async_payment_succeeded", { id: "cs_test_fake1" }))).toBe(200);
    expect((await getOrder(id))?.paymentStatus).toBe("paid");
    expect((await listOrderEvents(id)).filter((e) => e.type === "payment_status" && e.to === "paid")).toHaveLength(1);
  });

  it("expiry: the hold is released while checkout is closed", async () => {
    const { stripe, id } = await startedThenClosed();
    stripe.set("cs_test_fake1", { status: "expired" });
    expect(await webhook(stripe, event("checkout.session.expired", { id: "cs_test_fake1" }))).toBe(200);
    expect((await getOrder(id))?.paymentStatus).toBe("expired");
    expect(await stock()).toMatchObject({ reserved: 0 });
  });
});
