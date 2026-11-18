import type { DeliveryProof, FulfilmentStatus, OrderLineSnapshot, PaymentStatus } from "./types";

/**
 * Allowed payment moves. Anything else is refused, so a repeated or
 * out-of-order webhook can never move an order backwards (e.g. paid -> failed).
 */
const PAYMENT_MOVES: Record<PaymentStatus, readonly PaymentStatus[]> = {
  draft: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["paid", "cancelled", "expired", "failed"],
  paid: ["partially_refunded", "refunded"],
  partially_refunded: ["partially_refunded", "refunded"],
  // Mollie can still report "paid" after the stock hold ran out locally:
  // the money is taken, so the order is accepted and flagged for a stock check.
  cancelled: ["paid"],
  expired: ["paid"],
  failed: [],
  refunded: [],
};

/** Moves that are accepted but need a human check (late payment). */
const LATE_PAYMENT_FROM: readonly PaymentStatus[] = ["cancelled", "expired"];

export type TransitionResult<S> =
  | { ok: true; changed: true; next: S; needsReview?: string }
  /** Same state again (repeated webhook): nothing to write, not an error. */
  | { ok: true; changed: false; next: S }
  | { ok: false; reason: string };

export function nextPaymentStatus(current: PaymentStatus, target: PaymentStatus): TransitionResult<PaymentStatus> {
  // A partial refund that grows is a real change, the caller compares amounts.
  if (current === target && target !== "partially_refunded") return { ok: true, changed: false, next: current };
  if (!PAYMENT_MOVES[current].includes(target)) return { ok: false, reason: `payment_${current}_to_${target}` };
  if (target === "paid" && LATE_PAYMENT_FROM.includes(current)) {
    return { ok: true, changed: true, next: target, needsReview: "late_payment_check_stock" };
  }
  return { ok: true, changed: true, next: target };
}

/** Payment states in which stock stays held or sold. */
export function holdsStock(status: PaymentStatus): boolean {
  return status === "draft" || status === "awaiting_payment" || status === "paid" || status === "partially_refunded";
}

/** Payment states that can still be prepared and shipped. */
export function canFulfil(status: PaymentStatus): boolean {
  return status === "paid" || status === "partially_refunded";
}

/** First fulfilment state once paid: made-to-order items must be produced first. */
export function initialFulfilment(lines: Pick<OrderLineSnapshot, "stockMode">[]): FulfilmentStatus {
  return lines.some((l) => l.stockMode === "made_to_order") ? "to_produce" : "preparing";
}

const FULFILMENT_MOVES: Record<FulfilmentStatus, readonly FulfilmentStatus[]> = {
  to_produce: ["preparing"],
  preparing: ["ready"],
  ready: ["preparing", "shipped"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  returned: [],
};

/**
 * Admin fulfilment moves. "shipped" needs a tracking number when the service
 * is tracked; "delivered" needs a proof; a return is accepted whatever the
 * payment state (the parcel can come back after a refund).
 */
export function nextFulfilmentStatus(
  current: FulfilmentStatus | null,
  target: FulfilmentStatus,
  ctx: { paymentStatus: PaymentStatus; hasTracking: boolean; trackedService: boolean; proof?: DeliveryProof },
): TransitionResult<FulfilmentStatus> {
  if (current === null) return { ok: false, reason: "fulfilment_not_started" };
  if (current === target) return { ok: true, changed: false, next: current };
  if (target !== "returned" && !canFulfil(ctx.paymentStatus)) return { ok: false, reason: `fulfilment_blocked_${ctx.paymentStatus}` };
  if (!FULFILMENT_MOVES[current].includes(target)) return { ok: false, reason: `fulfilment_${current}_to_${target}` };
  if (target === "shipped" && ctx.trackedService && !ctx.hasTracking) return { ok: false, reason: "tracking_required" };
  if (target === "delivered") {
    if (!ctx.proof) return { ok: false, reason: "delivery_proof_required" };
    if (ctx.proof.kind === "tracking" && !ctx.hasTracking) return { ok: false, reason: "tracking_required" };
  }
  return { ok: true, changed: true, next: target };
}

/** Payment state implied by the refunded amount. */
export function refundStatus(totalCents: number, refundedCents: number): PaymentStatus | null {
  if (refundedCents <= 0) return null;
  return refundedCents >= totalCents ? "refunded" : "partially_refunded";
}

/** Checks an admin refund request before anything is sent to Mollie. */
export function validateRefund(
  order: { paymentStatus: PaymentStatus; totalCents: number; refundedCents: number },
  amountCents: number,
): { ok: true } | { ok: false; reason: string } {
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") return { ok: false, reason: "not_refundable" };
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, reason: "invalid_amount" };
  if (amountCents > order.totalCents - order.refundedCents) return { ok: false, reason: "amount_above_remaining" };
  return { ok: true };
}
