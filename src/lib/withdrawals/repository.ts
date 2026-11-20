import "server-only";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin-db";
import type { OrderRecord } from "@/lib/orders/types";
import {
  canMoveTo,
  isLiveOrder,
  isOrderRef,
  orderEligibility,
  selectLines,
  withdrawalDocId,
  type Ineligible,
  type Requester,
  type WithdrawalKind,
  type WithdrawalLine,
  type WithdrawalRecord,
  type WithdrawalStatus,
} from "./eligibility";

/**
 * withdrawals/{kind}_{ref}: one withdrawal request per order or per Mail Club
 * subscription, written by the server only (Admin SDK; firestore.rules refuse
 * the browser). The document id makes a second click, or a second request for
 * the same order, return the first one instead of creating a duplicate.
 */

const db = () => adminDb();
const withdrawals = () => db().collection("withdrawals");
const orders = () => db().collection("orders");

const iso = (v: unknown): string | null => (v instanceof Timestamp ? v.toDate().toISOString() : null);

function toRecord(id: string, d: DocumentData): WithdrawalRecord {
  return {
    id,
    kind: d.kind,
    ref: d.ref,
    customerUid: d.customerUid ?? null,
    name: d.name ?? "",
    email: d.email ?? "",
    lines: Array.isArray(d.lines) ? d.lines : [],
    status: d.status,
    receivedAt: iso(d.receivedAt) ?? "",
    orderCreatedAt: iso(d.orderCreatedAt),
    livemode: d.livemode !== false,
    stripeCancelled: typeof d.stripeCancelled === "boolean" ? d.stripeCancelled : undefined,
    handledAt: iso(d.handledAt),
  };
}

/** Order fields the eligibility rules and the summary need (no address, no price). */
export type OrderSummaryForWithdrawal = {
  id: string;
  createdAt: string | null;
  lines: WithdrawalLine[];
  alreadyRequested: boolean;
};

export type LookupResult = { kind: "ok"; order: OrderSummaryForWithdrawal } | { kind: Ineligible };

/** Step 1 of the public form: the order, if the requester owns it and it can be withdrawn. */
export async function lookupOrderForWithdrawal(orderId: string, who: Requester): Promise<LookupResult> {
  if (!isOrderRef(orderId)) return { kind: "not_found" };
  const [snap, existing] = await Promise.all([orders().doc(orderId).get(), withdrawals().doc(withdrawalDocId("order", orderId)).get()]);
  const d = snap.exists ? snap.data()! : null;
  const order = d ? { customerUid: d.customerUid ?? null, email: d.email ?? "", paymentStatus: d.paymentStatus } : null;
  const reason = orderEligibility(order, who);
  if (reason) return { kind: reason };
  const all = selectLines(d!.lines ?? [], (d!.lines ?? []).map((_: unknown, i: number) => i)) ?? [];
  return { kind: "ok", order: { id: orderId, createdAt: iso(d!.createdAt), lines: all, alreadyRequested: existing.exists } };
}

export type CreateResult = { kind: "created"; withdrawal: WithdrawalRecord } | { kind: "already"; withdrawal: WithdrawalRecord } | { kind: Ineligible } | { kind: "invalid_lines" };

/**
 * Records the withdrawal of an order, in one transaction with the order's
 * journal event and its review flag. Ownership and payment are checked again
 * here: the form's first step proves nothing.
 */
export async function createOrderWithdrawal(input: { orderId: string; who: Requester; name: string; lineIndexes: unknown[]; now: Date }): Promise<CreateResult> {
  if (!isOrderRef(input.orderId)) return { kind: "not_found" };
  return db().runTransaction(async (tx): Promise<CreateResult> => {
    const orderRef = orders().doc(input.orderId);
    const ref = withdrawals().doc(withdrawalDocId("order", input.orderId));
    const [snap, existing] = await Promise.all([tx.get(orderRef), tx.get(ref)]);
    const d = snap.exists ? snap.data()! : null;
    const order = d
      ? ({ customerUid: d.customerUid ?? null, email: d.email ?? "", paymentStatus: d.paymentStatus, paymentRef: d.paymentRef, lines: d.lines ?? [] } as Pick<
          OrderRecord,
          "customerUid" | "email" | "paymentStatus" | "paymentRef" | "lines"
        >)
      : null;
    const reason = orderEligibility(order, input.who);
    if (reason) return { kind: reason };
    if (existing.exists) return { kind: "already", withdrawal: toRecord(existing.id, existing.data()!) };
    const lines = selectLines(order!.lines, input.lineIndexes);
    if (!lines) return { kind: "invalid_lines" };

    const stamp = Timestamp.fromDate(input.now);
    const doc = {
      kind: "order" satisfies WithdrawalKind,
      ref: input.orderId,
      customerUid: order!.customerUid,
      name: input.name,
      // The order's own address: the acknowledgement never goes to an address typed in the form.
      email: order!.email,
      lines,
      status: "received" satisfies WithdrawalStatus,
      receivedAt: stamp,
      orderCreatedAt: d!.createdAt ?? null,
      livemode: isLiveOrder(order!),
      handledAt: null,
    };
    tx.create(ref, doc);
    tx.update(orderRef, { needsReview: "withdrawal", updatedAt: stamp });
    tx.create(orderRef.collection("events").doc(), { type: "withdrawal", source: "customer", code: "withdrawal_received", at: stamp });
    return { kind: "created", withdrawal: toRecord(ref.id, { ...doc, orderCreatedAt: d!.createdAt ?? null }) };
  });
}

/** Mail Club: one request per subscription. The caller checked that the subscription is the customer's. */
export async function createMailClubWithdrawal(input: {
  subscriptionId: string;
  uid: string;
  name: string;
  email: string;
  subscriptionCreatedAt: string | null;
  livemode: boolean;
  now: Date;
}): Promise<{ kind: "created" | "already"; withdrawal: WithdrawalRecord }> {
  const ref = withdrawals().doc(withdrawalDocId("mail_club", input.subscriptionId));
  return db().runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) return { kind: "already" as const, withdrawal: toRecord(existing.id, existing.data()!) };
    const doc = {
      kind: "mail_club" satisfies WithdrawalKind,
      ref: input.subscriptionId,
      customerUid: input.uid,
      name: input.name,
      email: input.email,
      lines: [{ index: 0, productName: "Dopamine Mail Club", variantName: "Abonnement mensuel", quantity: 1, personalised: false }] satisfies WithdrawalLine[],
      status: "received" satisfies WithdrawalStatus,
      receivedAt: Timestamp.fromDate(input.now),
      orderCreatedAt: input.subscriptionCreatedAt ? Timestamp.fromDate(new Date(input.subscriptionCreatedAt)) : null,
      livemode: input.livemode,
      stripeCancelled: false,
      handledAt: null,
    };
    tx.create(ref, doc);
    return { kind: "created" as const, withdrawal: toRecord(ref.id, doc) };
  });
}

export async function markStripeCancelled(id: string): Promise<void> {
  await withdrawals().doc(id).update({ stripeCancelled: true });
}

export async function getWithdrawal(kind: WithdrawalKind, ref: string): Promise<WithdrawalRecord | null> {
  if (!isOrderRef(ref)) return null;
  const snap = await withdrawals().doc(withdrawalDocId(kind, ref)).get();
  return snap.exists ? toRecord(snap.id, snap.data()!) : null;
}

/** Admin only (the caller checks the role). Most recent first. */
export async function listWithdrawals(): Promise<WithdrawalRecord[]> {
  const snap = await withdrawals().orderBy("receivedAt", "desc").limit(200).get();
  return snap.docs.map((d) => toRecord(d.id, d.data()));
}

/** Admin move (received -> refunded | closed, refunded -> closed). The refund itself is made in Stripe. */
export async function setWithdrawalStatus(id: string, to: WithdrawalStatus, adminUid: string, now: Date): Promise<boolean> {
  if (!/^(order|mail_club)_[A-Za-z0-9_-]{1,128}$/.test(id)) return false;
  return db().runTransaction(async (tx) => {
    const ref = withdrawals().doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists || !canMoveTo(snap.get("status"), to)) return false;
    const stamp = Timestamp.fromDate(now);
    tx.update(ref, { status: to, handledAt: stamp, handledBy: adminUid });
    if (snap.get("kind") === "order") {
      const orderRef = orders().doc(snap.get("ref"));
      tx.create(orderRef.collection("events").doc(), { type: "withdrawal", source: "admin", actorUid: adminUid, code: `withdrawal_${to}`, at: stamp });
    }
    return true;
  });
}
