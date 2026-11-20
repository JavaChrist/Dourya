import "server-only";
import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type DocumentData, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { defaultShippingSettings } from "@/config/shipping";
import type { ShippingAddress } from "@/lib/commerce-types";
import { adminDb } from "@/lib/firebase/admin-db";
import { validateShippingRate } from "@/lib/shipping/quote";
import type { ShippingRate, ShippingSettings } from "@/lib/shipping/types";
import { interpretPayment, type PaymentView } from "./payment-status";
import { initialFulfilment, nextFulfilmentStatus, nextPaymentStatus } from "./transitions";
import type { DeliveryProof, EventSource, FulfilmentStatus, OrderEvent, OrderLineSnapshot, OrderRecord, PaymentStatus, ShippingChoice, StockHold, TrackingInfo } from "./types";

/**
 * Orders, stock holds and checkout attempts in Firestore (Admin SDK only:
 * the security rules refuse every client write). Every change of state runs
 * in a transaction with its journal event, so a repeated or concurrent
 * request can neither sell the same unit twice nor change an order twice.
 */

const db = () => adminDb();
const orders = () => db().collection("orders");
const inventory = () => db().collection("inventory");
const attempts = () => db().collection("checkoutAttempts");

const ATTEMPT_KEY = /^[A-Za-z0-9_-]{16,64}$/;
const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/;

function iso(v: unknown): string {
  return v instanceof Timestamp ? v.toDate().toISOString() : typeof v === "string" ? v : "";
}

function toOrderRecord(id: string, d: DocumentData): OrderRecord {
  return {
    id,
    customerUid: d.customerUid ?? null,
    email: d.email,
    lines: d.lines ?? [],
    subtotalCents: d.subtotalCents,
    shippingCents: d.shippingCents,
    totalCents: d.totalCents,
    currency: "EUR",
    shipping: d.shipping,
    shippingAddress: d.shippingAddress,
    paymentStatus: d.paymentStatus,
    fulfilmentStatus: d.fulfilmentStatus ?? null,
    paymentRef: d.paymentRef ?? undefined,
    refundedCents: d.refundedCents ?? 0,
    tracking: d.tracking ?? undefined,
    stockHolds: d.stockHolds ?? [],
    stockState: d.stockState,
    reservationExpiresAt: d.reservationExpiresAt ? iso(d.reservationExpiresAt) : undefined,
    needsReview: d.needsReview ?? undefined,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

function addEvent(tx: Transaction, orderRef: DocumentReference, event: Omit<OrderEvent, "at">, now: Date) {
  const clean = Object.fromEntries(Object.entries(event).filter(([, v]) => v !== undefined));
  tx.create(orderRef.collection("events").doc(), { ...clean, at: Timestamp.fromDate(now) });
}

/**
 * Same content = same fingerprint. A reused attempt key with another
 * fingerprint means the cart (or address, shipping...) changed: refused.
 */
export function checkoutFingerprint(input: {
  email: string;
  lines: OrderLineSnapshot[];
  shipping: ShippingChoice;
  shippingAddress: ShippingAddress;
  totalCents: number;
}): string {
  const lines = input.lines.map((l) => [l.productId, l.variantId, l.quantity, l.unitPriceCents, l.personalisation?.text ?? ""]);
  const payload = JSON.stringify([input.email.toLowerCase(), lines, input.shipping.rateId, input.shipping.priceCents, input.shippingAddress, input.totalCents]);
  return createHash("sha256").update(payload).digest("hex");
}

/** Holds of the same counter are added up (two lines of one variant). */
function mergeHolds(holds: StockHold[]): StockHold[] {
  const byKey = new Map<string, number>();
  for (const h of holds) if (h.quantity > 0) byKey.set(h.key, (byKey.get(h.key) ?? 0) + h.quantity);
  return [...byKey].map(([key, quantity]) => ({ key, quantity }));
}

/**
 * Everything needed to send the same Stripe Checkout request again, value for
 * value: saved with the order, in its creation transaction, before the first
 * call to Stripe. A retry (lost response, double click, concurrent request)
 * replays it with the same idempotency key instead of building a new one.
 */
export type StoredPaymentRequest = {
  idempotencyKey: string;
  /** Unix seconds, sent as expires_at. */
  expiresAt: number;
  lines: { name: string; unitAmountCents: number; quantity: number }[];
  shipping: { label: string; amountCents: number };
  email: string;
  successUrl: string;
  cancelUrl: string;
  /** When it was saved (ms): Stripe keeps an idempotency key at least 24 h. */
  storedAtMs: number;
};

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

function readPaymentRequest(v: unknown): StoredPaymentRequest | undefined {
  if (!v || typeof v !== "object") return undefined;
  const r = v as StoredPaymentRequest;
  const ok =
    typeof r.idempotencyKey === "string" &&
    isInt(r.expiresAt) &&
    Array.isArray(r.lines) &&
    r.lines.every((l) => l && typeof l.name === "string" && isInt(l.unitAmountCents) && isInt(l.quantity)) &&
    r.shipping && typeof r.shipping.label === "string" && isInt(r.shipping.amountCents) &&
    typeof r.email === "string" &&
    typeof r.successUrl === "string" &&
    typeof r.cancelUrl === "string" &&
    isInt(r.storedAtMs);
  return ok ? r : undefined;
}

export type CreateOrderInput = {
  attemptKey: string;
  customerUid: string | null;
  email: string;
  lines: OrderLineSnapshot[];
  shipping: ShippingChoice;
  shippingAddress: ShippingAddress;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  /** One hold per limited counter, with the catalogue value used if the counter does not exist yet. */
  holds: (StockHold & { initialStock: number })[];
  reservationMinutes: number;
  /** Builds the Stripe request for the new order id (saved with the order). */
  paymentRequest?: (orderId: string) => Omit<StoredPaymentRequest, "storedAtMs">;
  now?: Date;
};

export type CreateOrderResult =
  | { kind: "created"; orderId: string; paymentRequest?: StoredPaymentRequest }
  /** Same attempt again (double click, reload, concurrent call): the first order and its saved request. */
  | { kind: "existing"; orderId: string; paymentRef?: string; paymentRequest?: StoredPaymentRequest }
  /** The attempt key was used for another content. */
  | { kind: "conflict" }
  | { kind: "out_of_stock"; keys: string[] }
  | { kind: "invalid"; reason: string };

function validateCreate(input: CreateOrderInput): string | null {
  if (!ATTEMPT_KEY.test(input.attemptKey)) return "attempt_key";
  if (input.lines.length === 0) return "empty";
  const linesTotal = input.lines.reduce((s, l) => s + l.lineTotalCents, 0);
  if (input.lines.some((l) => !Number.isInteger(l.quantity) || l.quantity <= 0 || l.lineTotalCents !== l.unitPriceCents * l.quantity)) return "line_total";
  if (linesTotal !== input.subtotalCents) return "subtotal";
  if (input.shippingCents !== input.shipping.priceCents) return "shipping";
  if (input.totalCents !== input.subtotalCents + input.shippingCents || input.totalCents <= 0) return "total";
  if (input.holds.some((h) => !DOC_ID.test(h.key) || !Number.isInteger(h.quantity) || h.quantity < 0 || !Number.isInteger(h.initialStock))) return "holds";
  if (!(input.reservationMinutes > 0)) return "reservation";
  return null;
}

/**
 * Creates the draft order and holds its stock in one transaction. Two
 * customers racing for the last unit: one gets it, the other gets
 * "out_of_stock". The same attempt twice returns the first order, unless
 * that order closed without payment (hold expired, cancelled, payment failed)
 * and released its stock: the attempt is then stale and a new order is
 * created for it (a retry from the same tab gets a fresh hold).
 */
/** Closed without payment: an attempt pointing at such an order may start over. */
const STALE_STATUSES = new Set<PaymentStatus>(["cancelled", "expired", "failed"]);

export async function createOrderWithReservation(input: CreateOrderInput): Promise<CreateOrderResult> {
  const invalid = validateCreate(input);
  if (invalid) return { kind: "invalid", reason: invalid };
  const now = input.now ?? new Date();
  const fingerprint = checkoutFingerprint(input);
  const initial = new Map(input.holds.map((h) => [h.key, h.initialStock]));
  const holds = mergeHolds(input.holds);

  return db().runTransaction(async (tx): Promise<CreateOrderResult> => {
    const attemptRef = attempts().doc(input.attemptKey);
    const attempt = await tx.get(attemptRef);
    if (attempt.exists) {
      if (attempt.get("fingerprint") !== fingerprint) return { kind: "conflict" };
      const previous = await tx.get(orders().doc(attempt.get("orderId") as string));
      const stale = previous.exists && STALE_STATUSES.has(previous.get("paymentStatus")) && previous.get("stockState") === "released";
      if (!stale) {
        const paymentRequest = previous.exists ? readPaymentRequest(previous.get("paymentRequest")) : undefined;
        return { kind: "existing", orderId: attempt.get("orderId"), paymentRef: attempt.get("paymentRef") ?? undefined, ...(paymentRequest ? { paymentRequest } : {}) };
      }
    }

    const refs = holds.map((h) => inventory().doc(h.key));
    const snaps = refs.length ? await tx.getAll(...refs) : [];
    const short: string[] = [];
    snaps.forEach((snap, i) => {
      const stock = snap.exists ? (snap.get("stock") as number) : (initial.get(holds[i].key) ?? 0);
      const reserved = snap.exists ? ((snap.get("reserved") as number) ?? 0) : 0;
      if (stock - reserved < holds[i].quantity) short.push(holds[i].key);
    });
    if (short.length) return { kind: "out_of_stock", keys: short };

    snaps.forEach((snap, i) => {
      if (snap.exists) {
        tx.update(refs[i], { reserved: FieldValue.increment(holds[i].quantity), updatedAt: Timestamp.fromDate(now) });
      } else {
        tx.create(refs[i], { stock: initial.get(holds[i].key) ?? 0, reserved: holds[i].quantity, updatedAt: Timestamp.fromDate(now) });
      }
    });

    const orderRef = orders().doc();
    const paymentRequest: StoredPaymentRequest | undefined = input.paymentRequest ? { ...input.paymentRequest(orderRef.id), storedAtMs: now.getTime() } : undefined;
    tx.create(orderRef, {
      customerUid: input.customerUid,
      email: input.email,
      lines: input.lines,
      subtotalCents: input.subtotalCents,
      shippingCents: input.shippingCents,
      totalCents: input.totalCents,
      currency: "EUR",
      shipping: input.shipping,
      shippingAddress: input.shippingAddress,
      paymentStatus: "draft" satisfies PaymentStatus,
      fulfilmentStatus: null,
      refundedCents: 0,
      stockHolds: holds,
      stockState: holds.length ? "held" : "released",
      reservationExpiresAt: Timestamp.fromMillis(now.getTime() + input.reservationMinutes * 60_000),
      attemptKey: input.attemptKey,
      ...(paymentRequest ? { paymentRequest } : {}),
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    });
    // set, not create: a stale attempt is pointed at the new order.
    tx.set(attemptRef, { orderId: orderRef.id, fingerprint, createdAt: Timestamp.fromDate(now) });
    addEvent(tx, orderRef, { type: "created", source: "checkout", to: "draft", amountCents: input.totalCents }, now);
    return { kind: "created", orderId: orderRef.id, ...(paymentRequest ? { paymentRequest } : {}) };
  });
}

export type AttachResult = { kind: "attached" } | { kind: "unchanged" } | { kind: "not_found" } | { kind: "refused"; reason: string };

/** Links the provider payment (Stripe Checkout Session) to the draft order: draft -> awaiting_payment. */
export async function attachPayment(orderId: string, paymentRef: string, now = new Date()): Promise<AttachResult> {
  if (!DOC_ID.test(orderId) || !DOC_ID.test(paymentRef)) return { kind: "not_found" };
  return db().runTransaction(async (tx): Promise<AttachResult> => {
    const ref = orders().doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "not_found" };
    const current = snap.get("paymentRef") as string | undefined;
    if (current) return current === paymentRef ? { kind: "unchanged" } : { kind: "refused", reason: "payment_already_attached" };
    const step = nextPaymentStatus(snap.get("paymentStatus"), "awaiting_payment");
    if (!step.ok || !step.changed) return { kind: "refused", reason: step.ok ? "not_draft" : step.reason };
    tx.update(ref, { paymentRef, paymentStatus: "awaiting_payment", updatedAt: Timestamp.fromDate(now) });
    tx.update(attempts().doc(snap.get("attemptKey")), { paymentRef });
    addEvent(tx, ref, { type: "payment_status", source: "checkout", from: "draft", to: "awaiting_payment", providerRef: paymentRef }, now);
    return { kind: "attached" };
  });
}

export type ApplyResult =
  | { kind: "updated"; from: PaymentStatus; to: PaymentStatus; needsReview?: string }
  | { kind: "unchanged" }
  | { kind: "anomaly"; code: string }
  | { kind: "not_found" };

const PRE_PAID: readonly PaymentStatus[] = ["draft", "awaiting_payment", "cancelled", "expired"];
const REFUND_STATES: readonly PaymentStatus[] = ["partially_refunded", "refunded"];

/**
 * Applies a payment re-read at the payment provider (never the webhook body). Stock moves
 * with the payment: sold when paid, given back on failure, expiry or
 * cancellation. A repeated notification writes nothing.
 */
export async function applyPaymentState(orderId: string, payment: PaymentView, source: EventSource, now = new Date()): Promise<ApplyResult> {
  if (!DOC_ID.test(orderId)) return { kind: "not_found" };
  return db().runTransaction(async (tx): Promise<ApplyResult> => {
    const ref = orders().doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "not_found" };
    const order = toOrderRecord(snap.id, snap.data()!);

    const flag = (code: string): ApplyResult => {
      // Flagged once: a repeated webhook does not pile up the same anomaly.
      if (order.needsReview !== code) {
        tx.update(ref, { needsReview: code, updatedAt: Timestamp.fromDate(now) });
        addEvent(tx, ref, { type: "anomaly", source, code, providerRef: payment.id }, now);
      }
      return { kind: "anomaly", code };
    };

    if (order.paymentRef !== payment.id) return flag("payment_id_mismatch");
    const read = interpretPayment(payment, order);
    if (!read.ok) return flag(read.anomaly);

    // A missed "paid" notification: go through paid before the refund state.
    const targets: PaymentStatus[] =
      REFUND_STATES.includes(read.target) && PRE_PAID.includes(order.paymentStatus) ? ["paid", read.target] : [read.target];

    let status = order.paymentStatus;
    let needsReview: string | undefined;
    for (const target of targets) {
      if (target === "partially_refunded" && status === "partially_refunded" && read.refundedCents === order.refundedCents) continue;
      const step = nextPaymentStatus(status, target);
      if (!step.ok) return flag(step.reason);
      if (step.changed) {
        needsReview ??= step.needsReview;
        status = step.next;
      }
    }
    if (status === order.paymentStatus && read.refundedCents === order.refundedCents) return { kind: "unchanged" };

    // Reads are done before any write (Firestore transactions).
    const becomesPaid = !["paid", ...REFUND_STATES].includes(order.paymentStatus) && (status === "paid" || REFUND_STATES.includes(status));
    const releases = ["cancelled", "expired", "failed"].includes(status) && order.stockState === "held";
    const holdRefs = order.stockHolds.map((h) => inventory().doc(h.key));
    const holdSnaps = (becomesPaid || releases) && holdRefs.length ? await tx.getAll(...holdRefs) : [];

    const stamp = Timestamp.fromDate(now);
    holdSnaps.forEach((s, i) => {
      const q = order.stockHolds[i].quantity;
      const fromHeld = order.stockState === "held";
      if (!s.exists) {
        // The counter vanished (manual cleanup): never invent stock, flag it.
        needsReview ??= "inventory_missing";
        return;
      }
      if (becomesPaid) {
        tx.update(holdRefs[i], { stock: FieldValue.increment(-q), ...(fromHeld ? { reserved: FieldValue.increment(-q) } : {}), updatedAt: stamp });
        if (!fromHeld && (s.get("stock") as number) - ((s.get("reserved") as number) ?? 0) < q) needsReview ??= "late_payment_check_stock";
      } else {
        tx.update(holdRefs[i], { reserved: FieldValue.increment(-q), updatedAt: stamp });
      }
    });

    const update: DocumentData = { paymentStatus: status, refundedCents: read.refundedCents, updatedAt: stamp };
    if (becomesPaid) {
      update.fulfilmentStatus = initialFulfilment(order.lines);
      if (order.stockHolds.length) update.stockState = "committed";
    }
    if (releases) update.stockState = "released";
    if (needsReview) update.needsReview = needsReview;
    tx.update(ref, update);

    if (status !== order.paymentStatus) {
      addEvent(tx, ref, { type: "payment_status", source, from: order.paymentStatus, to: status, providerRef: payment.id, code: needsReview }, now);
    }
    if (read.refundedCents > order.refundedCents) {
      addEvent(tx, ref, { type: "refund", source, amountCents: read.refundedCents - order.refundedCents, providerRef: payment.id }, now);
    }
    return { kind: "updated", from: order.paymentStatus, to: status, needsReview };
  });
}

/**
 * What Stripe says about a draft's saved request (see placeOrder):
 * session = it created this session (current state re-read);
 * none = proven that it created no session and can no longer create one;
 * uncertain = not established yet (reviewCode once Stripe can no longer tell).
 */
export type DraftResolution = { kind: "session"; payment: PaymentView } | { kind: "none" } | { kind: "uncertain"; reviewCode?: string };

/**
 * Safety net for holds whose payment never notified. An awaited payment is
 * re-read at Stripe through `fetchPayment` and applied as such (still open at
 * Stripe = still held, no oversell). A draft whose Stripe request was sent
 * (saved request, response lost) is resolved through `resolveDraft`: the
 * session it created is attached and applied, the draft is cancelled only
 * when no session can exist, and it stays held while that is uncertain. A
 * draft without a saved request (older orders) is cancelled.
 */
export async function releaseExpiredReservations(
  fetchPayment: (paymentRef: string) => Promise<PaymentView>,
  now = new Date(),
  limit = 50,
  resolveDraft?: (orderId: string, request: StoredPaymentRequest) => Promise<DraftResolution>,
): Promise<{ checked: number; changed: number }> {
  const snap = await orders()
    .where("paymentStatus", "in", ["draft", "awaiting_payment"])
    .where("reservationExpiresAt", "<", Timestamp.fromDate(now))
    .orderBy("reservationExpiresAt")
    .limit(limit)
    .get();
  let changed = 0;
  for (const doc of snap.docs) {
    const paymentRef = doc.get("paymentRef") as string | undefined;
    if (paymentRef) {
      const result = await applyPaymentState(doc.id, await fetchPayment(paymentRef), "system", now);
      if (result.kind === "updated") changed++;
      continue;
    }
    const request = readPaymentRequest(doc.get("paymentRequest"));
    if (!request) {
      if (await cancelDraft(doc.id, now)) changed++;
      continue;
    }
    if (!resolveDraft) continue;
    const resolution = await resolveDraft(doc.id, request);
    if (resolution.kind === "session") {
      const attached = await attachPayment(doc.id, resolution.payment.id, now);
      const applied = await applyPaymentState(doc.id, resolution.payment, "system", now);
      if (attached.kind === "attached" || applied.kind === "updated") changed++;
    } else if (resolution.kind === "none") {
      if (await cancelDraft(doc.id, now, "payment_request_failed")) changed++;
    } else if (resolution.reviewCode) {
      await flagOrder(doc.id, resolution.reviewCode, "system", now);
    }
  }
  return { checked: snap.size, changed };
}

/** Marks an order for a human check, once (no repeated event). */
export async function flagOrder(orderId: string, code: string, source: EventSource, now = new Date()): Promise<void> {
  if (!DOC_ID.test(orderId)) return;
  await db().runTransaction(async (tx) => {
    const ref = orders().doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("needsReview") === code) return;
    tx.update(ref, { needsReview: code, updatedAt: Timestamp.fromDate(now) });
    addEvent(tx, ref, { type: "anomaly", source, code }, now);
  });
}

/**
 * Cancels a draft that has no payment attached and gives its stock back. The
 * caller must have established that no payment can come for it (hold expired
 * without a sent request, or Stripe proved the request created no session).
 */
export async function cancelDraft(orderId: string, now: Date, code = "reservation_expired"): Promise<boolean> {
  if (!DOC_ID.test(orderId)) return false;
  return db().runTransaction(async (tx) => {
    const ref = orders().doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("paymentStatus") !== "draft" || snap.get("paymentRef")) return false;
    const holds = (snap.get("stockHolds") as StockHold[]) ?? [];
    const held = snap.get("stockState") === "held";
    const holdRefs = holds.map((h) => inventory().doc(h.key));
    const holdSnaps = held && holdRefs.length ? await tx.getAll(...holdRefs) : [];
    const stamp = Timestamp.fromDate(now);
    holdSnaps.forEach((s, i) => {
      if (s.exists) tx.update(holdRefs[i], { reserved: FieldValue.increment(-holds[i].quantity), updatedAt: stamp });
    });
    tx.update(ref, { paymentStatus: "cancelled", stockState: "released", updatedAt: stamp });
    addEvent(tx, ref, { type: "payment_status", source: "system", from: "draft", to: "cancelled", code }, now);
    return true;
  });
}

export async function getOrder(orderId: string): Promise<OrderRecord | null> {
  if (!DOC_ID.test(orderId)) return null;
  const snap = await orders().doc(orderId).get();
  return snap.exists ? toOrderRecord(snap.id, snap.data()!) : null;
}

export async function listOrderEvents(orderId: string): Promise<OrderEvent[]> {
  if (!DOC_ID.test(orderId)) return [];
  const snap = await orders().doc(orderId).collection("events").orderBy("at").limit(200).get();
  return snap.docs.map((d) => ({ ...(d.data() as OrderEvent), at: iso(d.get("at")) }));
}

function isValidRate(r: unknown): r is ShippingRate {
  if (!r || typeof r !== "object") return false;
  const rate = r as ShippingRate;
  if (typeof rate.label !== "string" || typeof rate.id !== "string" || typeof rate.enabled !== "boolean" || typeof rate.freeShippingEligible !== "boolean") return false;
  return validateShippingRate(rate).length === 0;
}

/**
 * Shipping settings saved by the admin, or the defaults (no rate). An invalid
 * rate is dropped, never fixed up.
 */
export async function getShippingSettings(): Promise<ShippingSettings> {
  const snap = await db().collection("settings").doc("shipping").get();
  if (!snap.exists) return defaultShippingSettings;
  const d = snap.data() as Partial<ShippingSettings>;
  const threshold = d.freeShippingThresholdCents;
  return {
    zones: Array.isArray(d.zones) ? d.zones : defaultShippingSettings.zones,
    rates: Array.isArray(d.rates) ? d.rates.filter(isValidRate) : [],
    freeShippingThresholdCents: Number.isInteger(threshold) && (threshold as number) > 0 ? (threshold as number) : null,
  };
}

/** Latest orders, newest first (admin list). */
export async function listRecentOrders(limit = 200): Promise<OrderRecord[]> {
  const snap = await orders().orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => toOrderRecord(d.id, d.data()));
}

export type FulfilmentResult = { kind: "updated"; from: FulfilmentStatus | null; to: FulfilmentStatus } | { kind: "unchanged" } | { kind: "refused"; reason: string } | { kind: "not_found" };

/**
 * Admin fulfilment move (preparing, ready, shipped, delivered, returned), checked by
 * nextFulfilmentStatus: "shipped" on a tracked service needs a tracking number,
 * "delivered" needs a proof. The tracking given with "shipped" is saved in the
 * same transaction; each change is journalled with the admin uid.
 */
export async function setFulfilmentStatus(
  orderId: string,
  target: FulfilmentStatus,
  opts: { adminUid: string; tracking?: TrackingInfo; proof?: DeliveryProof },
  now = new Date(),
): Promise<FulfilmentResult> {
  if (!DOC_ID.test(orderId)) return { kind: "not_found" };
  return db().runTransaction(async (tx): Promise<FulfilmentResult> => {
    const ref = orders().doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "not_found" };
    const order = toOrderRecord(snap.id, snap.data()!);
    const tracking = target === "shipped" && opts.tracking ? opts.tracking : order.tracking;
    const move = nextFulfilmentStatus(order.fulfilmentStatus, target, {
      paymentStatus: order.paymentStatus,
      hasTracking: Boolean(tracking?.number),
      trackedService: order.shipping.service === "tracked",
      proof: opts.proof,
    });
    if (!move.ok) return { kind: "refused", reason: move.reason };
    if (!move.changed) return { kind: "unchanged" };
    const at = Timestamp.fromDate(now);
    const update: Record<string, unknown> = { fulfilmentStatus: move.next, updatedAt: at };
    if (target === "shipped" && opts.tracking) {
      update.tracking = Object.fromEntries(Object.entries(opts.tracking).filter(([, v]) => v !== undefined));
      addEvent(tx, ref, { type: "tracking", source: "admin", actorUid: opts.adminUid }, now);
    }
    tx.update(ref, update);
    addEvent(
      tx,
      ref,
      { type: "fulfilment_status", source: "admin", from: order.fulfilmentStatus, to: move.next, actorUid: opts.adminUid, code: opts.proof?.kind },
      now,
    );
    return { kind: "updated", from: order.fulfilmentStatus, to: move.next };
  });
}
