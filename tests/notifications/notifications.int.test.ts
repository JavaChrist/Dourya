import { beforeEach, describe, expect, it, vi } from "vitest";
import { placeOrder, refreshOrderState } from "@/lib/checkout/service";
import { testOutbox } from "@/lib/email/send";
import { adminAuth } from "@/lib/firebase/admin-auth";
import { adminDb } from "@/lib/firebase/admin-db";
import { notifyMailClub, notifyOrder, orderNotificationStatuses } from "@/lib/notifications/service";
import { getOrder, setFulfilmentStatus } from "@/lib/orders/repository";
import type { SubscriptionView } from "@/lib/payments/stripe-subscriptions";
import { clearAuth } from "../helpers/auth-emulator";
import { completed, deps, event, fakeStripe, onlyOrderId, order, T0, webhook } from "../checkout/fixtures";

// Checkout stays closed in the real config: opened here only, for the tests.
vi.mock("@/config/commerce", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/commerce")>();
  return { ...actual, commerceConfig: { ...actual.commerceConfig, checkoutEnabled: true } };
});

// Fictitious data only, on the emulators, with the in-memory e-mail outbox: nothing is ever sent.
const host = () => process.env.FIRESTORE_EMULATOR_HOST;
beforeEach(async () => {
  await fetch(`http://${host()}/emulator/v1/projects/demo-dourya/databases/(default)/documents`, { method: "DELETE" });
  testOutbox().clear();
});

const sent = (subject: string) => testOutbox().sent.filter((m) => m.subject.includes(subject));
const CONFIRMED = "est confirmée";
const SHIPPED = "est en route";
const REFUNDED = "Votre remboursement";

async function paidOrder() {
  const stripe = fakeStripe();
  await placeOrder(order(), deps(stripe));
  const id = await onlyOrderId();
  stripe.set("cs_test_fake1", { status: "paid" });
  return { stripe, id };
}

describe("order e-mails", () => {
  it("confirmation: sent once, whatever the number of webhooks and return pages", async () => {
    const { stripe, id } = await paidOrder();
    expect(sent(CONFIRMED)).toHaveLength(0);
    expect(await webhook(stripe, completed())).toBe(200);
    expect(await webhook(stripe, completed())).toBe(200);
    await refreshOrderState(id, stripe.access, T0);
    await Promise.all([notifyOrder(id, T0), notifyOrder(id, T0)]);
    const mails = sent(CONFIRMED);
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("client@example.test");
    expect(mails[0].text).toContain(`n° ${id}`);
    expect(await orderNotificationStatuses(id)).toEqual({ confirmed: "sent" });
  });

  it("no e-mail while the payment is not confirmed", async () => {
    const stripe = fakeStripe();
    await placeOrder(order(), deps(stripe));
    const id = await onlyOrderId();
    expect(await webhook(stripe, completed())).toBe(200);
    await notifyOrder(id, T0);
    expect(testOutbox().sent).toHaveLength(0);
  });

  it("refund: one e-mail per new amount, never twice for the same one", async () => {
    const { stripe, id } = await paidOrder();
    await webhook(stripe, completed());
    const refunded = event("charge.refunded", { id: "ch_test", payment_intent: "pi_fake1" });

    stripe.set("cs_test_fake1", { refundedCents: 500 });
    expect(await webhook(stripe, refunded)).toBe(200);
    expect(await webhook(stripe, refunded)).toBe(200);
    expect(sent(REFUNDED)).toHaveLength(1);
    expect(sent(REFUNDED)[0].text).toContain("5,00");

    stripe.set("cs_test_fake1", { refundedCents: 1200 });
    expect(await webhook(stripe, refunded)).toBe(200);
    await notifyOrder(id, T0);
    const mails = sent(REFUNDED);
    expect(mails).toHaveLength(2);
    // The second e-mail gives only the new amount (7 €): the order is now fully refunded.
    expect(mails[1].text).toContain("remboursée : 7,00");
    expect((await getOrder(id))?.paymentStatus).toBe("refunded");
    expect(sent(CONFIRMED)).toHaveLength(1);
  });

  it("shipping: tracking required on a tracked service, then one e-mail with the number", async () => {
    const { stripe, id } = await paidOrder();
    await webhook(stripe, completed());
    await adminDb().collection("orders").doc(id).update({ "shipping.service": "tracked" });
    const admin = { adminUid: "admin_test" };
    if ((await getOrder(id))?.fulfilmentStatus === "to_produce") await setFulfilmentStatus(id, "preparing", admin, T0);
    expect(await setFulfilmentStatus(id, "ready", admin, T0)).toMatchObject({ kind: "updated", to: "ready" });
    expect((await getOrder(id))?.fulfilmentStatus).toBe("ready");

    expect(await setFulfilmentStatus(id, "shipped", admin, T0)).toMatchObject({ kind: "refused" });
    const tracking = { carrier: "La Poste", number: "LA123456789FR", url: "https://www.laposte.fr/outils/suivre-vos-envois?code=LA123456789FR" };
    expect(await setFulfilmentStatus(id, "shipped", { ...admin, tracking }, T0)).toMatchObject({ kind: "updated", to: "shipped" });
    await notifyOrder(id, T0);
    await notifyOrder(id, T0);

    // Delivered later: no new "shipped" e-mail.
    expect(await setFulfilmentStatus(id, "delivered", { ...admin, proof: { kind: "tracking" } }, T0)).toMatchObject({ kind: "updated" });
    await notifyOrder(id, T0);

    const mails = sent(SHIPPED);
    expect(mails).toHaveLength(1);
    expect(mails[0].text).toContain("LA123456789FR");
    expect(mails[0].html).toContain("https://www.laposte.fr/");
    expect(await orderNotificationStatuses(id)).toEqual({ confirmed: "sent", shipped: "sent" });
  });

  it("an unpaid order cannot be shipped", async () => {
    const stripe = fakeStripe();
    await placeOrder(order(), deps(stripe));
    const id = await onlyOrderId();
    expect(await setFulfilmentStatus(id, "preparing", { adminUid: "admin_test" }, T0)).toMatchObject({ kind: "refused" });
    expect(await setFulfilmentStatus("missing", "preparing", { adminUid: "admin_test" }, T0)).toEqual({ kind: "not_found" });
  });
});

describe("Mail Club e-mails", () => {
  const UID = "mc_user_test";
  const EMAIL = "abonne@example.test";
  const view = (over: Partial<SubscriptionView> = {}): SubscriptionView => ({
    id: "sub_test",
    customerId: "cus_test",
    status: "active",
    uid: UID,
    currentPeriodEnd: Math.floor(T0.getTime() / 1000) + 30 * 86400,
    cancelAtPeriodEnd: false,
    priceCents: 1195,
    shipping: { name: "Client Test", line1: "1 rue Test", postalCode: "75000", city: "Paris", country: "FR" },
    livemode: false,
    startedAt: Math.floor(T0.getTime() / 1000),
    ...over,
  });

  beforeEach(async () => {
    await clearAuth();
    await adminAuth().createUser({ uid: UID, email: EMAIL });
  });

  it("welcome once, then one cancellation confirmation", async () => {
    await notifyMailClub(view(), T0);
    await notifyMailClub(view(), T0);
    expect(sent("Bienvenue")).toHaveLength(1);
    expect(sent("Bienvenue")[0].to).toBe(EMAIL);

    await notifyMailClub(view({ cancelAtPeriodEnd: true }), T0);
    await notifyMailClub(view({ cancelAtPeriodEnd: true }), T0);
    const cancelled = sent("Résiliation");
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].text).toContain("aucun nouveau prélèvement");
    expect(testOutbox().sent).toHaveLength(2);
  });

  it("no welcome for an old subscription, nor for one not yet paid", async () => {
    const old = Math.floor(T0.getTime() / 1000) - 40 * 86400;
    await notifyMailClub(view({ startedAt: old }), T0);
    await notifyMailClub(view({ id: "sub_incomplete", status: "incomplete" }), T0);
    await notifyMailClub(view({ uid: null }), T0);
    expect(testOutbox().sent).toHaveLength(0);
  });
});
