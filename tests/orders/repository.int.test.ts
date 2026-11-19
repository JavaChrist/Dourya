import { beforeEach, describe, expect, it } from "vitest";
import { adminDb } from "@/lib/firebase/admin-db";
import type { PaymentView } from "@/lib/orders/payment-status";
import {
  applyPaymentState,
  attachPayment,
  createOrderWithReservation,
  getOrder,
  getShippingSettings,
  listOrderEvents,
  releaseExpiredReservations,
  type CreateOrderInput,
} from "@/lib/orders/repository";

// Fictitious data only, on the emulators: no real customer, price or rate.
const host = () => process.env.FIRESTORE_EMULATOR_HOST;
beforeEach(async () => {
  await fetch(`http://${host()}/emulator/v1/projects/demo-dourya/databases/(default)/documents`, { method: "DELETE" });
});

const T0 = new Date("2026-01-10T10:00:00Z");
const KEY = "p1__v1";

const input = (over: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
  attemptKey: "attempt-aaaaaaaaaaaa",
  customerUid: null,
  email: "client@example.test",
  lines: [
    { productId: "p1", variantId: "v1", sku: "TEST-1", productName: "Produit test", variantName: "A5", unitPriceCents: 1000, quantity: 1, lineTotalCents: 1000, stockMode: "stocked" },
  ],
  shipping: { rateId: "test-rate", label: "Tarif test", zone: "FR", envelope: "standard", service: "letter", priceCents: 200 },
  shippingAddress: { fullName: "Client Test", line1: "1 rue Test", postalCode: "75000", city: "Paris", country: "FR" },
  subtotalCents: 1000,
  shippingCents: 200,
  totalCents: 1200,
  holds: [{ key: KEY, quantity: 1, initialStock: 1 }],
  reservationMinutes: 30,
  now: T0,
  ...over,
});

const payment = (over: Partial<PaymentView> = {}, orderId = ""): PaymentView => ({
  id: "cs_test_1",
  status: "paid",
  amountCents: 1200,
  currency: "eur",
  refundedCents: 0,
  orderId,
  ...over,
});

const stock = async () => (await adminDb().collection("inventory").doc(KEY).get()).data();

async function placeAwaiting(over: Partial<CreateOrderInput> = {}) {
  const created = await createOrderWithReservation(input(over));
  if (created.kind !== "created") throw new Error(created.kind);
  expect(await attachPayment(created.orderId, "cs_test_1", T0)).toEqual({ kind: "attached" });
  return created.orderId;
}

describe("checkout: creation and stock hold", () => {
  it("creates a draft order and holds the stock", async () => {
    const res = await createOrderWithReservation(input());
    expect(res.kind).toBe("created");
    const order = await getOrder((res as { orderId: string }).orderId);
    expect(order).toMatchObject({ paymentStatus: "draft", fulfilmentStatus: null, stockState: "held", totalCents: 1200 });
    expect(order?.reservationExpiresAt).toBe("2026-01-10T10:30:00.000Z");
    expect(await stock()).toMatchObject({ stock: 1, reserved: 1 });
  });

  it("double click: the same attempt returns the same order, held once", async () => {
    const [a, b] = await Promise.all([createOrderWithReservation(input()), createOrderWithReservation(input())]);
    const ids = [a, b].map((r) => ("orderId" in r ? r.orderId : null));
    expect(ids[0]).toBe(ids[1]);
    expect([a.kind, b.kind].sort()).toEqual(["created", "existing"]);
    expect((await adminDb().collection("orders").get()).size).toBe(1);
    expect(await stock()).toMatchObject({ reserved: 1 });
  });

  it("modified cart with the same attempt key is refused", async () => {
    await createOrderWithReservation(input());
    const changed = input({
      lines: [{ ...input().lines[0], quantity: 2, lineTotalCents: 2000 }],
      subtotalCents: 2000,
      totalCents: 2200,
    });
    expect(await createOrderWithReservation(changed)).toEqual({ kind: "conflict" });
  });

  it("two customers race for the last unit: only one gets it", async () => {
    const results = await Promise.all([
      createOrderWithReservation(input({ attemptKey: "attempt-customer-one" })),
      createOrderWithReservation(input({ attemptKey: "attempt-customer-two" })),
    ]);
    expect(results.map((r) => r.kind).sort()).toEqual(["created", "out_of_stock"]);
    expect(await stock()).toMatchObject({ stock: 1, reserved: 1 });
  });

  it("refuses inconsistent totals", async () => {
    expect(await createOrderWithReservation(input({ totalCents: 1 }))).toEqual({ kind: "invalid", reason: "total" });
    expect(await createOrderWithReservation(input({ attemptKey: "short" }))).toEqual({ kind: "invalid", reason: "attempt_key" });
  });
});

describe("payment: re-read state applied once", () => {
  it("paid: stock sold, fulfilment starts, a repeated webhook changes nothing", async () => {
    const id = await placeAwaiting();
    expect(await applyPaymentState(id, payment({}, id), "stripe_webhook", T0)).toMatchObject({ kind: "updated", from: "awaiting_payment", to: "paid" });
    expect(await applyPaymentState(id, payment({}, id), "stripe_webhook", T0)).toEqual({ kind: "unchanged" });
    expect(await getOrder(id)).toMatchObject({ paymentStatus: "paid", fulfilmentStatus: "preparing", stockState: "committed" });
    expect(await stock()).toMatchObject({ stock: 0, reserved: 0 });
    const events = await listOrderEvents(id);
    expect(events.filter((e) => e.type === "payment_status").map((e) => e.to).sort()).toEqual(["awaiting_payment", "paid"]); // same fixed clock: order among ties is not guaranteed
  });

  it("failure releases the held stock", async () => {
    const id = await placeAwaiting();
    expect(await applyPaymentState(id, payment({ status: "failed" }, id), "stripe_webhook", T0)).toMatchObject({ to: "failed" });
    expect(await getOrder(id)).toMatchObject({ paymentStatus: "failed", stockState: "released", fulfilmentStatus: null });
    expect(await stock()).toMatchObject({ stock: 1, reserved: 0 });
  });

  it("late payment after expiry is accepted and flagged for review", async () => {
    const id = await placeAwaiting();
    await applyPaymentState(id, payment({ status: "expired" }, id), "stripe_webhook", T0);
    // Someone else bought the unit meanwhile.
    await createOrderWithReservation(input({ attemptKey: "attempt-other-buyer" }));
    const res = await applyPaymentState(id, payment({}, id), "stripe_webhook", T0);
    expect(res).toMatchObject({ kind: "updated", from: "expired", to: "paid", needsReview: "late_payment_check_stock" });
    expect(await getOrder(id)).toMatchObject({ paymentStatus: "paid", needsReview: "late_payment_check_stock" });
  });

  it("amount mismatch is an anomaly, flagged once, status unchanged", async () => {
    const id = await placeAwaiting();
    const wrong = payment({ amountCents: 100 }, id);
    expect(await applyPaymentState(id, wrong, "stripe_webhook", T0)).toEqual({ kind: "anomaly", code: "amount_mismatch" });
    await applyPaymentState(id, wrong, "stripe_webhook", T0);
    expect(await getOrder(id)).toMatchObject({ paymentStatus: "awaiting_payment", needsReview: "amount_mismatch" });
    expect((await listOrderEvents(id)).filter((e) => e.type === "anomaly")).toHaveLength(1);
  });

  it("another payment id is refused", async () => {
    const id = await placeAwaiting();
    expect(await applyPaymentState(id, payment({ id: "cs_test_other" }, id), "stripe_webhook", T0)).toEqual({ kind: "anomaly", code: "payment_id_mismatch" });
    expect(await attachPayment(id, "cs_test_other", T0)).toEqual({ kind: "refused", reason: "payment_already_attached" });
  });

  it("partial then full refund", async () => {
    const id = await placeAwaiting();
    await applyPaymentState(id, payment({}, id), "stripe_webhook", T0);
    const partial = payment({ refundedCents: 500 }, id);
    const at = (s: number) => new Date(T0.getTime() + s * 1000);
    expect(await applyPaymentState(id, partial, "stripe_webhook", at(1))).toMatchObject({ to: "partially_refunded" });
    expect(await applyPaymentState(id, partial, "stripe_webhook", at(2))).toEqual({ kind: "unchanged" });
    const full = payment({ refundedCents: 1200 }, id);
    expect(await applyPaymentState(id, full, "stripe_webhook", at(3))).toMatchObject({ from: "partially_refunded", to: "refunded" });
    expect(await getOrder(id)).toMatchObject({ refundedCents: 1200, paymentStatus: "refunded" });
    expect((await listOrderEvents(id)).filter((e) => e.type === "refund").map((e) => e.amountCents)).toEqual([500, 700]);
  });
});

describe("expiry sweep", () => {
  it("cancels an expired draft and asks Stripe for an awaited payment", async () => {
    const draft = await createOrderWithReservation(input({ attemptKey: "attempt-draft-only1", holds: [] }));
    const awaited = await placeAwaiting();
    const later = new Date(T0.getTime() + 31 * 60_000);
    const asked: string[] = [];
    const res = await releaseExpiredReservations(async (pid) => {
      asked.push(pid);
      return payment({ status: "expired" }, awaited);
    }, later);
    expect(res).toEqual({ checked: 2, changed: 2 });
    expect(asked).toEqual(["cs_test_1"]);
    expect(await getOrder((draft as { orderId: string }).orderId)).toMatchObject({ paymentStatus: "cancelled" });
    expect(await getOrder(awaited)).toMatchObject({ paymentStatus: "expired", stockState: "released" });
    expect(await stock()).toMatchObject({ reserved: 0 });
  });

  it("leaves holds that have not expired", async () => {
    await placeAwaiting();
    expect(await releaseExpiredReservations(async () => payment(), T0)).toEqual({ checked: 0, changed: 0 });
  });
});

describe("shipping settings", () => {
  it("falls back to the defaults (no rate) and drops invalid rates", async () => {
    expect((await getShippingSettings()).rates).toEqual([]);
    await adminDb().collection("settings").doc("shipping").set({ rates: [{ id: "Bad id" }], freeShippingThresholdCents: -5 });
    const s = await getShippingSettings();
    expect(s.rates).toEqual([]);
    expect(s.freeShippingThresholdCents).toBeNull();
    expect(s.zones.find((z) => z.code === "FR")?.enabled).toBe(true);
  });
});
