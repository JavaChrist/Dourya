import "server-only";
import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin-db";
import { LIVE_STATUSES, type InvoiceView, type ShippingAddress, type SubscriptionStatus, type SubscriptionView } from "@/lib/payments/stripe-subscriptions";

/**
 * Mail Club data, written by the server only (Admin SDK; refused to the
 * browser by firestore.rules). Always a copy of what Stripe says, re-read at
 * Stripe before each write: Stripe stays the source of truth for payments.
 *
 * subscriptions/{subscriptionId}     uid, status, period end, cancellation, delivery address
 * mailClubDeliveries/{invoiceId}     one pack to send per paid invoice ("to_send" -> "sent")
 * settings/mailClub                  the pack of the month (title, text), entered in the admin
 */

export type StoredSubscription = {
  id: string;
  uid: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceCents: number | null;
  shipping: ShippingAddress | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Delivery = {
  id: string;
  subscriptionId: string;
  uid: string;
  amountCents: number;
  paidAt: string | null;
  shipping: ShippingAddress | null;
  status: "to_send" | "sent";
  sentAt: string | null;
};

export type MailClubPack = { title: string; description: string; updatedAt: string | null };

const subscriptions = () => adminDb().collection("subscriptions");
const deliveries = () => adminDb().collection("mailClubDeliveries");
const packRef = () => adminDb().collection("settings").doc("mailClub");

const iso = (v: unknown): string | null => (v instanceof Timestamp ? v.toDate().toISOString() : null);
const fromUnix = (sec: number | null) => (sec === null ? null : Timestamp.fromMillis(sec * 1000));

function toSubscription(id: string, d: DocumentData): StoredSubscription {
  return {
    id,
    uid: d.uid,
    status: d.status,
    currentPeriodEnd: iso(d.currentPeriodEnd),
    cancelAtPeriodEnd: d.cancelAtPeriodEnd === true,
    priceCents: typeof d.priceCents === "number" ? d.priceCents : null,
    shipping: d.shipping ?? null,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

function toDelivery(id: string, d: DocumentData): Delivery {
  return {
    id,
    subscriptionId: d.subscriptionId,
    uid: d.uid,
    amountCents: d.amountCents,
    paidAt: iso(d.paidAt),
    shipping: d.shipping ?? null,
    status: d.status === "sent" ? "sent" : "to_send",
    sentAt: iso(d.sentAt),
  };
}

/**
 * Saves the state just read at Stripe. A subscription that does not carry the
 * uid set by this server is never stored. The uid of a stored subscription
 * never changes. Returns false when nothing was stored.
 */
export async function saveSubscription(view: SubscriptionView, now: Date): Promise<boolean> {
  if (!view.uid) return false;
  const uid = view.uid;
  const ref = subscriptions().doc(view.id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.get("uid") !== uid) return false;
    const at = Timestamp.fromDate(now);
    tx.set(
      ref,
      {
        uid,
        customerId: view.customerId,
        status: view.status,
        currentPeriodEnd: fromUnix(view.currentPeriodEnd),
        cancelAtPeriodEnd: view.cancelAtPeriodEnd,
        priceCents: view.priceCents,
        // An address Stripe no longer returns is kept (the last known one).
        ...(view.shipping ? { shipping: view.shipping } : {}),
        updatedAt: at,
        ...(snap.exists ? {} : { createdAt: at }),
      },
      { merge: true },
    );
    return true;
  });
}

/** One pack per paid invoice: a repeated event changes nothing. Returns "created" or "exists". */
export async function recordDelivery(invoice: InvoiceView, subscription: StoredSubscription | SubscriptionView, now: Date): Promise<"created" | "exists"> {
  const ref = deliveries().doc(invoice.id);
  return adminDb().runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) return "exists";
    tx.create(ref, {
      subscriptionId: subscription.id,
      uid: subscription.uid,
      amountCents: invoice.amountPaidCents,
      paidAt: fromUnix(invoice.paidAt) ?? Timestamp.fromDate(now),
      shipping: subscription.shipping ?? null,
      status: "to_send",
      createdAt: Timestamp.fromDate(now),
    });
    return "created";
  });
}

export async function getSubscription(id: string): Promise<StoredSubscription | null> {
  const snap = await subscriptions().doc(id).get();
  return snap.exists ? toSubscription(snap.id, snap.data()!) : null;
}

/** The customer's current subscription: a live one first, otherwise the most recent. */
export async function getUserSubscription(uid: string): Promise<StoredSubscription | null> {
  const snap = await subscriptions().where("uid", "==", uid).limit(20).get();
  const list = snap.docs.map((d) => toSubscription(d.id, d.data()));
  const rank = (s: StoredSubscription) => (LIVE_STATUSES.includes(s.status) ? 1 : 0);
  list.sort((a, b) => rank(b) - rank(a) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return list[0] ?? null;
}

export async function listUserDeliveries(uid: string): Promise<Delivery[]> {
  const snap = await deliveries().where("uid", "==", uid).limit(100).get();
  return snap.docs.map((d) => toDelivery(d.id, d.data())).sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
}

export async function listSubscriptions(): Promise<StoredSubscription[]> {
  const snap = await subscriptions().limit(500).get();
  return snap.docs.map((d) => toSubscription(d.id, d.data())).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function listDeliveries(status: Delivery["status"]): Promise<Delivery[]> {
  const snap = await deliveries().where("status", "==", status).limit(500).get();
  return snap.docs.map((d) => toDelivery(d.id, d.data())).sort((a, b) => (a.paidAt ?? "").localeCompare(b.paidAt ?? ""));
}

/** Admin: the pack has been posted. False when it does not exist or was already marked. */
export async function markDeliverySent(id: string, adminUid: string, now: Date): Promise<boolean> {
  const ref = deliveries().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("status") !== "to_send") return false;
    tx.update(ref, { status: "sent", sentAt: Timestamp.fromDate(now), sentBy: adminUid });
    return true;
  });
}

export async function getMailClubPack(): Promise<MailClubPack | null> {
  const snap = await packRef().get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  if (typeof d.title !== "string" || !d.title) return null;
  return { title: d.title, description: typeof d.description === "string" ? d.description : "", updatedAt: iso(d.updatedAt) };
}

export async function saveMailClubPack(pack: { title: string; description: string }, adminUid: string): Promise<void> {
  await packRef().set({ ...pack, updatedAt: FieldValue.serverTimestamp(), updatedBy: adminUid });
}
