import { beforeEach, describe, expect, it } from "vitest";
import { adminDb } from "@/lib/firebase/admin-db";
import type { StripeAccess } from "@/lib/payments/stripe";
import { StripeError, type StripeClient } from "@/lib/payments/stripe-client";
import type { CreateSubscriptionCheckoutInput, InvoiceView, SubscriptionClient, SubscriptionView } from "@/lib/payments/stripe-subscriptions";
import { getUserSubscription, listDeliveries, listUserDeliveries, markDeliverySent } from "@/lib/subscriptions/repository";
import { cancelMailClub, confirmMailClubReturn, handleSubscriptionEvent, startMailClub } from "@/lib/subscriptions/service";

// Fictitious data only, on the emulators: no real customer, key or Stripe account.
const host = () => process.env.FIRESTORE_EMULATOR_HOST;
beforeEach(async () => {
  await fetch(`http://${host()}/emulator/v1/projects/demo-dourya/databases/(default)/documents`, { method: "DELETE" });
});

const T0 = new Date("2026-01-10T10:00:00Z");
const ORIGIN = "https://shop.example.test";
const OPEN = { checkoutEnabled: true, allowDemoCheckoutInTestMode: false };
const shipping = { name: "Client Test", line1: "1 rue Test", postalCode: "75000", city: "Paris", country: "FR" };

const sub = (over: Partial<SubscriptionView> = {}): SubscriptionView => ({
  id: "sub_a",
  customerId: "cus_a",
  status: "active",
  uid: "user_a",
  currentPeriodEnd: 1_770_000_000,
  cancelAtPeriodEnd: false,
  priceCents: 1195,
  shipping,
  ...over,
});

/** In-memory Stripe Billing: subscriptions and invoices set by the test. */
function fakeBilling() {
  const subs = new Map<string, SubscriptionView>();
  const invoices = new Map<string, InvoiceView>();
  const sessions = new Map<string, { uid: string | null; subscriptionId: string | null; complete: boolean }>();
  const created: CreateSubscriptionCheckoutInput[] = [];
  const notFound = () => new StripeError("not_found", 404);
  const client: SubscriptionClient = {
    async createSubscriptionCheckout(input) {
      created.push(input);
      return { id: "cs_test_sub1", url: "https://checkout.stripe.com/c/pay/cs_test_sub1" };
    },
    async getSubscriptionCheckout(id) {
      const s = sessions.get(id);
      if (!s) throw notFound();
      return { id, ...s };
    },
    async getSubscription(id) {
      const s = subs.get(id);
      if (!s) throw notFound();
      return { ...s };
    },
    async getInvoice(id) {
      const i = invoices.get(id);
      if (!i) throw notFound();
      return { ...i };
    },
    async cancelAtPeriodEnd(id) {
      const s = subs.get(id);
      if (!s) throw notFound();
      s.cancelAtPeriodEnd = true;
      return { ...s };
    },
  };
  const access: StripeAccess = { client: {} as StripeClient, mode: "test", subscriptions: client };
  return { client, access, subs, invoices, sessions, created };
}

describe("Mail Club webhook", () => {
  it("saves the subscription and records one pack per paid invoice", async () => {
    const b = fakeBilling();
    b.subs.set("sub_a", sub());
    b.invoices.set("in_1", { id: "in_1", subscriptionId: "sub_a", paid: true, amountPaidCents: 1195, paidAt: 1_768_000_000 });

    expect(await handleSubscriptionEvent({ kind: "subscription", type: "customer.subscription.created", subscriptionId: "sub_a" }, b.client, T0)).toBe(200);
    expect(await handleSubscriptionEvent({ kind: "invoice", type: "invoice.paid", invoiceId: "in_1" }, b.client, T0)).toBe(200);
    // Stripe resends the event: still one pack.
    expect(await handleSubscriptionEvent({ kind: "invoice", type: "invoice.paid", invoiceId: "in_1" }, b.client, T0)).toBe(200);

    expect(await getUserSubscription("user_a")).toMatchObject({ id: "sub_a", status: "active", priceCents: 1195, shipping });
    const packs = await listUserDeliveries("user_a");
    expect(packs).toHaveLength(1);
    expect(packs[0]).toMatchObject({ id: "in_1", amountCents: 1195, status: "to_send", shipping });

    expect(await markDeliverySent("in_1", "admin_1", T0)).toBe(true);
    expect(await markDeliverySent("in_1", "admin_1", T0)).toBe(false);
    expect(await listDeliveries("to_send")).toHaveLength(0);
  });

  it("records no pack for a failed invoice and ignores foreign subscriptions", async () => {
    const b = fakeBilling();
    b.subs.set("sub_a", sub({ status: "past_due" }));
    b.subs.set("sub_x", sub({ id: "sub_x", uid: null }));
    b.invoices.set("in_2", { id: "in_2", subscriptionId: "sub_a", paid: false, amountPaidCents: 0, paidAt: null });

    expect(await handleSubscriptionEvent({ kind: "invoice", type: "invoice.payment_failed", invoiceId: "in_2" }, b.client, T0)).toBe(200);
    expect(await handleSubscriptionEvent({ kind: "subscription", type: "customer.subscription.updated", subscriptionId: "sub_x" }, b.client, T0)).toBe(200);
    expect(await handleSubscriptionEvent({ kind: "subscription", type: "customer.subscription.updated", subscriptionId: "sub_gone" }, b.client, T0)).toBe(200);

    expect((await getUserSubscription("user_a"))?.status).toBe("past_due");
    expect(await listUserDeliveries("user_a")).toHaveLength(0);
    expect((await adminDb().collection("subscriptions").doc("sub_x").get()).exists).toBe(false);
  });

  it("never moves a stored subscription to another customer", async () => {
    const b = fakeBilling();
    b.subs.set("sub_a", sub());
    await handleSubscriptionEvent({ kind: "subscription", type: "customer.subscription.created", subscriptionId: "sub_a" }, b.client, T0);
    b.subs.set("sub_a", sub({ uid: "user_b", status: "canceled" }));
    await handleSubscriptionEvent({ kind: "subscription", type: "customer.subscription.updated", subscriptionId: "sub_a" }, b.client, T0);
    expect(await getUserSubscription("user_b")).toBeNull();
    expect((await getUserSubscription("user_a"))?.status).toBe("active");
  });

  it("asks Stripe to retry when Stripe cannot be reached", async () => {
    const b = fakeBilling();
    b.client.getSubscription = async () => {
      throw new StripeError("network", null);
    };
    expect(await handleSubscriptionEvent({ kind: "subscription", type: "customer.subscription.updated", subscriptionId: "sub_a" }, b.client, T0)).toBe(500);
  });
});

describe("Mail Club customer flows", () => {
  const user = { uid: "user_a", email: "client@example.test" };

  it("starts a subscription only when open, with the terms accepted, once", async () => {
    const b = fakeBilling();
    expect(await startMailClub({ user, acceptTerms: true, stripe: b.access, sw: { ...OPEN, checkoutEnabled: false }, origin: ORIGIN, now: T0 })).toEqual({ kind: "closed", reason: "checkout_closed" });
    expect(await startMailClub({ user, acceptTerms: true, stripe: { ...b.access, mode: "live" }, sw: OPEN, origin: ORIGIN, now: T0 })).toMatchObject({ kind: "closed" });
    expect(await startMailClub({ user, acceptTerms: false, stripe: b.access, sw: OPEN, origin: ORIGIN, now: T0 })).toEqual({ kind: "terms" });

    const started = await startMailClub({ user, acceptTerms: true, stripe: b.access, sw: OPEN, origin: ORIGIN, now: T0 });
    expect(started).toEqual({ kind: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_sub1" });
    expect(b.created[0]).toMatchObject({ uid: "user_a", priceCents: 1195, successUrl: `${ORIGIN}/mon-compte/abonnement?session={CHECKOUT_SESSION_ID}` });

    // Back from Stripe: a session of another customer is not accepted.
    b.subs.set("sub_a", sub());
    b.sessions.set("cs_test_sub1", { uid: "user_a", subscriptionId: "sub_a", complete: true });
    await confirmMailClubReturn("user_b", "cs_test_sub1", b.access, T0);
    expect(await getUserSubscription("user_b")).toBeNull();
    await confirmMailClubReturn("user_a", "cs_test_sub1", b.access, T0);
    expect((await getUserSubscription("user_a"))?.status).toBe("active");

    expect(await startMailClub({ user, acceptTerms: true, stripe: b.access, sw: OPEN, origin: ORIGIN, now: T0 })).toEqual({ kind: "already" });
  });

  it("cancels at the end of the period, only the customer's own subscription", async () => {
    const b = fakeBilling();
    expect(await cancelMailClub("user_a", b.access, T0)).toBe("none");
    b.subs.set("sub_a", sub());
    await handleSubscriptionEvent({ kind: "subscription", type: "customer.subscription.created", subscriptionId: "sub_a" }, b.client, T0);

    expect(await cancelMailClub("user_b", b.access, T0)).toBe("none");
    expect(await cancelMailClub("user_a", b.access, T0)).toBe("ok");
    expect(await getUserSubscription("user_a")).toMatchObject({ status: "active", cancelAtPeriodEnd: true });
    expect(await cancelMailClub("user_a", b.access, T0)).toBe("already");
  });
});
