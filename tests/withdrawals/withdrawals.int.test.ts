import { beforeEach, describe, expect, it } from "vitest";
import { testOutbox } from "@/lib/email/send";
import { adminDb } from "@/lib/firebase/admin-db";
import { applyPaymentState, attachPayment, createOrderWithReservation, getOrder, listOrderEvents, type CreateOrderInput } from "@/lib/orders/repository";
import type { StripeAccess } from "@/lib/payments/stripe";
import { StripeError, type StripeClient } from "@/lib/payments/stripe-client";
import type { SubscriptionClient, SubscriptionView } from "@/lib/payments/stripe-subscriptions";
import { getUserSubscription, saveSubscription } from "@/lib/subscriptions/repository";
import { getWithdrawal, listWithdrawals, lookupOrderForWithdrawal, setWithdrawalStatus } from "@/lib/withdrawals/repository";
import { submitOrderWithdrawal, withdrawMailClub } from "@/lib/withdrawals/service";

// Fictitious data only, on the emulators, with the in-memory e-mail outbox: nothing is ever sent.
const host = () => process.env.FIRESTORE_EMULATOR_HOST;
beforeEach(async () => {
  await fetch(`http://${host()}/emulator/v1/projects/demo-dourya/databases/(default)/documents`, { method: "DELETE" });
  testOutbox().clear();
});

const T0 = new Date("2026-01-10T10:00:00Z");
const T1 = new Date("2026-01-15T09:00:00Z");
const EMAIL = "client@example.test";

const input = (over: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
  attemptKey: "attempt-wwwwwwwwwwww",
  customerUid: "user_a",
  email: EMAIL,
  lines: [
    { productId: "p1", variantId: "v1", sku: "TEST-1", productName: "Carnet test", variantName: "A5", unitPriceCents: 1000, quantity: 1, lineTotalCents: 1000, stockMode: "stocked" },
    {
      productId: "p2",
      variantId: "v2",
      sku: "TEST-2",
      productName: "Badge test",
      variantName: "",
      unitPriceCents: 500,
      quantity: 2,
      lineTotalCents: 1000,
      stockMode: "stocked",
      personalisation: { label: "Prénom", text: "Test", surchargeCents: 0 },
    },
  ],
  shipping: { rateId: "test-rate", label: "Tarif test", zone: "FR", envelope: "standard", service: "letter", priceCents: 200 },
  shippingAddress: { fullName: "Client Test", line1: "1 rue Test", postalCode: "75000", city: "Paris", country: "FR" },
  subtotalCents: 2000,
  shippingCents: 200,
  totalCents: 2200,
  holds: [
    { key: "p1__v1", quantity: 1, initialStock: 5 },
    { key: "p2__v2", quantity: 2, initialStock: 5 },
  ],
  reservationMinutes: 30,
  now: T0,
  ...over,
});

async function paidOrder(over: Partial<CreateOrderInput> = {}, sessionId = "cs_test_w1"): Promise<string> {
  const created = await createOrderWithReservation(input(over));
  if (created.kind !== "created") throw new Error(created.kind);
  const id = created.orderId;
  expect(await attachPayment(id, sessionId, T0)).toEqual({ kind: "attached" });
  const res = await applyPaymentState(id, { id: sessionId, status: "paid", amountCents: 2200, currency: "eur", refundedCents: 0, orderId: id }, "stripe_webhook", T0);
  expect(res).toMatchObject({ kind: "updated", to: "paid" });
  return id;
}

describe("order withdrawal", () => {
  it("finds the order for its owner (account or e-mail) and hides it from anyone else", async () => {
    const id = await paidOrder();
    const byUid = await lookupOrderForWithdrawal(id, { uid: "user_a" });
    expect(byUid.kind).toBe("ok");
    expect(await lookupOrderForWithdrawal(id, { email: "CLIENT@example.test" })).toMatchObject({ kind: "ok" });
    expect(await lookupOrderForWithdrawal(id, { uid: "user_b" })).toEqual({ kind: "not_found" });
    expect(await lookupOrderForWithdrawal(id, { email: "autre@example.test" })).toEqual({ kind: "not_found" });
    expect(await lookupOrderForWithdrawal("inconnue123", { uid: "user_a" })).toEqual({ kind: "not_found" });
    if (byUid.kind === "ok") expect(byUid.order.lines.map((l) => l.personalised)).toEqual([false, true]);
  });

  it("refuses an unpaid order", async () => {
    const created = await createOrderWithReservation(input());
    if (created.kind !== "created") throw new Error(created.kind);
    expect(await lookupOrderForWithdrawal(created.orderId, { uid: "user_a" })).toEqual({ kind: "not_paid" });
  });

  it("records one request, flags the order, writes the event and acknowledges once", async () => {
    const id = await paidOrder();
    const first = await submitOrderWithdrawal({ orderId: id, who: { email: EMAIL }, name: "Client Test", lineIndexes: ["0", "1"], now: T1 });
    expect(first.kind).toBe("created");
    const again = await submitOrderWithdrawal({ orderId: id, who: { uid: "user_a" }, name: "Client Test", lineIndexes: ["0"], now: T1 });
    expect(again.kind).toBe("already");

    const w = await getWithdrawal("order", id);
    expect(w).toMatchObject({ kind: "order", ref: id, status: "received", email: EMAIL, livemode: false, receivedAt: T1.toISOString() });
    expect(w?.lines).toHaveLength(2);
    expect(w?.lines[1].personalised).toBe(true);

    expect((await getOrder(id))?.needsReview).toBe("withdrawal");
    const events = await listOrderEvents(id);
    expect(events.filter((e) => e.type === "withdrawal")).toHaveLength(1);

    const sent = testOutbox().sent;
    expect(sent.map((m) => m.to).sort()).toEqual([EMAIL, "contact@dourya.fr"].sort());
    expect(sent[0].subject).toBeTruthy();

    const lookup = await lookupOrderForWithdrawal(id, { uid: "user_a" });
    expect(lookup.kind === "ok" && lookup.order.alreadyRequested).toBe(true);
  });

  it("sends the acknowledgement to the order's e-mail, never to someone else", async () => {
    const id = await paidOrder();
    expect((await submitOrderWithdrawal({ orderId: id, who: { email: "autre@example.test" }, name: "Intrus", lineIndexes: ["0"], now: T1 })).kind).toBe("not_found");
    expect(testOutbox().sent).toHaveLength(0);
    expect(await getWithdrawal("order", id)).toBeNull();
  });

  it("needs at least one item of the order", async () => {
    const id = await paidOrder();
    expect((await submitOrderWithdrawal({ orderId: id, who: { uid: "user_a" }, name: "Client Test", lineIndexes: [], now: T1 })).kind).toBe("invalid_lines");
    expect((await submitOrderWithdrawal({ orderId: id, who: { uid: "user_a" }, name: "Client Test", lineIndexes: ["7"], now: T1 })).kind).toBe("invalid_lines");
    expect(await getWithdrawal("order", id)).toBeNull();
  });

  it("admin follow-up: received → refunded → closed, never backwards", async () => {
    const id = await paidOrder();
    await submitOrderWithdrawal({ orderId: id, who: { uid: "user_a" }, name: "Client Test", lineIndexes: ["0"], now: T1 });
    const docId = `order_${id}`;
    expect(await setWithdrawalStatus(docId, "refunded", "admin_1", T1)).toBe(true);
    expect(await setWithdrawalStatus(docId, "refunded", "admin_1", T1)).toBe(false);
    expect(await setWithdrawalStatus(docId, "closed", "admin_1", T1)).toBe(true);
    expect(await setWithdrawalStatus(docId, "received", "admin_1", T1)).toBe(false);
    expect(await setWithdrawalStatus("../orders/x", "closed", "admin_1", T1)).toBe(false);
    expect((await listWithdrawals())[0]).toMatchObject({ id: docId, status: "closed" });
    const codes = (await listOrderEvents(id)).filter((e) => e.type === "withdrawal").map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(["withdrawal_received", "withdrawal_refunded", "withdrawal_closed"]));
  });
});

describe("Mail Club withdrawal", () => {
  const shipping = { name: "Client Test", line1: "1 rue Test", postalCode: "75000", city: "Paris", country: "FR" };
  const view = (over: Partial<SubscriptionView> = {}): SubscriptionView => ({
    id: "sub_w",
    customerId: "cus_w",
    status: "active",
    uid: "user_a",
    currentPeriodEnd: 1_770_000_000,
    cancelAtPeriodEnd: false,
    priceCents: 1195,
    shipping,
    livemode: false,
    ...over,
  });

  function fakeStripe(fail = false) {
    const subs = new Map<string, SubscriptionView>([["sub_w", view()]]);
    let cancels = 0;
    const notFound = () => new StripeError("not_found", 404);
    const client = {
      async getSubscription(id: string) {
        const s = subs.get(id);
        if (!s) throw notFound();
        return { ...s };
      },
      async cancelNow(id: string) {
        cancels++;
        if (fail) throw new StripeError("unavailable", 503);
        const s = subs.get(id);
        if (!s) throw notFound();
        s.status = "canceled";
        return { ...s };
      },
    } as unknown as SubscriptionClient;
    const access: StripeAccess = { client: {} as StripeClient, mode: "test", subscriptions: client };
    return { access, cancels: () => cancels };
  }

  it("stops the subscription at once and acknowledges once", async () => {
    await saveSubscription(view(), T0);
    const s = fakeStripe();
    expect(await withdrawMailClub({ uid: "user_a", name: "Client Test", email: EMAIL }, s.access, T1)).toBe("ok");
    expect((await getUserSubscription("user_a"))?.status).toBe("canceled");
    expect(await getWithdrawal("mail_club", "sub_w")).toMatchObject({ kind: "mail_club", stripeCancelled: true, status: "received", livemode: false });
    expect(testOutbox().sent.map((m) => m.to).sort()).toEqual([EMAIL, "contact@dourya.fr"].sort());
    // Nothing left to withdraw from.
    expect(await withdrawMailClub({ uid: "user_a", name: "Client Test", email: EMAIL }, s.access, T1)).toBe("none");
    expect(testOutbox().sent).toHaveLength(2);
  });

  it("keeps the request when Stripe fails, and a retry only stops the subscription", async () => {
    await saveSubscription(view(), T0);
    expect(await withdrawMailClub({ uid: "user_a", name: "Client Test", email: EMAIL }, fakeStripe(true).access, T1)).toBe("pending");
    expect(await getWithdrawal("mail_club", "sub_w")).toMatchObject({ stripeCancelled: false });
    expect(testOutbox().sent).toHaveLength(2);

    expect(await withdrawMailClub({ uid: "user_a", name: "Client Test", email: EMAIL }, fakeStripe().access, T1)).toBe("ok");
    expect(await getWithdrawal("mail_club", "sub_w")).toMatchObject({ stripeCancelled: true });
    expect(testOutbox().sent).toHaveLength(2);
  });

  it("does nothing without a live subscription", async () => {
    expect(await withdrawMailClub({ uid: "user_a", name: "Client Test", email: EMAIL }, fakeStripe().access, T1)).toBe("none");
    expect((await adminDb().collection("withdrawals").get()).size).toBe(0);
  });
});
