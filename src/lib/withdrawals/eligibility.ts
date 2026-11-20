import type { OrderLineSnapshot, OrderRecord } from "@/lib/orders/types";

/**
 * Online withdrawal (CGV article 7, Code de la consommation L. 221-18 s.).
 * Pure rules, no I/O: the repository runs them inside its transaction.
 *
 * Choices validated with DOURYA:
 * - the 14-day deadline is not enforced here (the delivery date is not always
 *   known): any paid order can be submitted, the admin checks the deadline;
 * - personalised items (L. 221-28) can be submitted too: they are flagged and
 *   the admin applies the exclusion;
 * - one request per order (document id derived from the order id).
 */

export type WithdrawalKind = "order" | "mail_club";
export type WithdrawalStatus = "received" | "refunded" | "closed";

export type WithdrawalLine = {
  /** Index of the line in the order (stable: an order's lines never change). */
  index: number;
  productName: string;
  variantName: string;
  quantity: number;
  /** Made to the customer's specification: excluded from withdrawal, checked by the admin. */
  personalised: boolean;
};

export type WithdrawalRecord = {
  id: string;
  kind: WithdrawalKind;
  /** Order id, or Stripe subscription id for the Mail Club. */
  ref: string;
  customerUid: string | null;
  name: string;
  email: string;
  lines: WithdrawalLine[];
  status: WithdrawalStatus;
  /** Server date of the request (proof of the notification). */
  receivedAt: string;
  orderCreatedAt: string | null;
  /** false = TEST order or subscription (Stripe test mode). */
  livemode: boolean;
  /** Mail Club only: the subscription was stopped at Stripe at once. */
  stripeCancelled?: boolean;
  handledAt: string | null;
};

/** Deadline to send the goods back (14 days after the notification) and to refund (14 days too). */
export const WITHDRAWAL_DAYS = 14;

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

export const withdrawalDocId = (kind: WithdrawalKind, ref: string) => `${kind}_${ref}`;

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Order number as printed for the customer (ids are generated, never typed with spaces). */
export const ORDER_REF = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function isOrderRef(value: unknown): value is string {
  return typeof value === "string" && ORDER_REF.test(value);
}

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL.test(value.trim());
}

/** Name typed by the customer: 2 to 80 visible characters, no control or markup character. */
export function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80 || /[\u0000-\u001f\u007f<>]/.test(name)) return null;
  return name;
}

export type Requester = { uid?: string | null; email?: string | null };

/** Same account, or same e-mail as the order (guest checkout). */
export function ownsOrder(order: Pick<OrderRecord, "customerUid" | "email">, who: Requester): boolean {
  if (who.uid && order.customerUid && order.customerUid === who.uid) return true;
  return Boolean(who.email && order.email && normaliseEmail(order.email) === normaliseEmail(who.email));
}

export type Ineligible = "not_found" | "not_paid" | "refunded";

/**
 * Whether the requester may withdraw from this order. A missing order and
 * someone else's order give the same answer, so nothing is revealed.
 */
export function orderEligibility(order: Pick<OrderRecord, "customerUid" | "email" | "paymentStatus"> | null, who: Requester): Ineligible | null {
  if (!order || !ownsOrder(order, who)) return "not_found";
  if (order.paymentStatus === "refunded") return "refunded";
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") return "not_paid";
  return null;
}

export function toWithdrawalLines(lines: OrderLineSnapshot[]): WithdrawalLine[] {
  return lines.map((l, index) => ({
    index,
    productName: l.productName,
    variantName: l.variantName,
    quantity: l.quantity,
    // Made to order is not enough: only a customer's text makes the item personalised.
    personalised: Boolean(l.personalisation),
  }));
}

/** Lines picked by the customer: valid, unique indexes of the order; at least one. */
export function selectLines(lines: OrderLineSnapshot[], picked: unknown[]): WithdrawalLine[] | null {
  const all = toWithdrawalLines(lines);
  const indexes = new Set<number>();
  for (const raw of picked) {
    const n = typeof raw === "string" && /^\d{1,3}$/.test(raw) ? Number(raw) : typeof raw === "number" ? raw : NaN;
    if (!Number.isInteger(n) || n < 0 || n >= all.length) return null;
    indexes.add(n);
  }
  if (indexes.size === 0) return null;
  return all.filter((l) => indexes.has(l.index));
}

/** Stripe test Checkout Sessions start with cs_test_: such an order is TEST data. */
export function isLiveOrder(order: Pick<OrderRecord, "paymentRef">): boolean {
  return !order.paymentRef?.startsWith("cs_test_");
}

/** Allowed admin moves: received -> refunded | closed, refunded -> closed. */
export function canMoveTo(from: WithdrawalStatus, to: WithdrawalStatus): boolean {
  return (from === "received" && (to === "refunded" || to === "closed")) || (from === "refunded" && to === "closed");
}
