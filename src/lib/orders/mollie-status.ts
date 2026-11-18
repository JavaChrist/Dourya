import type { PaymentStatus } from "./types";
import { refundStatus } from "./transitions";

/** Mollie amounts are strings with exactly two decimals ("12.30"). */
export type MollieAmount = { currency: string; value: string };

/** The fields of a Mollie payment that the shop reads (GET /v2/payments/:id). */
export type MolliePaymentView = {
  id: string;
  status: "open" | "canceled" | "pending" | "authorized" | "expired" | "failed" | "paid";
  amount: MollieAmount;
  amountRefunded?: MollieAmount;
  metadata?: unknown;
};

/** "12.30" -> 1230. Parsed as text: no floating point on money. null when not a valid amount. */
export function amountToCents(value: string): number | null {
  const match = /^(\d{1,9})\.(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 100 + Number(match[2]);
}

/** 1230 -> "12.30", the format Mollie requires. */
export function centsToAmount(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError("cents must be a non-negative integer");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export type MollieInterpretation =
  | { ok: true; target: PaymentStatus; refundedCents: number }
  /** The payment does not match the order: nothing is changed, the order is flagged. */
  | { ok: false; anomaly: "order_mismatch" | "currency_mismatch" | "amount_mismatch" | "invalid_amount" };

/**
 * Turns a payment re-read at Mollie into the order's target payment state.
 * The webhook body is never trusted: only this re-read is used, and only if
 * the payment belongs to the order with the expected amount in EUR.
 */
export function interpretMolliePayment(
  payment: MolliePaymentView,
  order: { id: string; totalCents: number },
): MollieInterpretation {
  const metaOrderId = (payment.metadata as { orderId?: unknown } | null | undefined)?.orderId;
  if (metaOrderId !== order.id) return { ok: false, anomaly: "order_mismatch" };
  if (payment.amount.currency !== "EUR") return { ok: false, anomaly: "currency_mismatch" };
  const amount = amountToCents(payment.amount.value);
  if (amount === null) return { ok: false, anomaly: "invalid_amount" };
  if (amount !== order.totalCents) return { ok: false, anomaly: "amount_mismatch" };

  const refundedCents = payment.amountRefunded ? amountToCents(payment.amountRefunded.value) : 0;
  if (refundedCents === null) return { ok: false, anomaly: "invalid_amount" };

  switch (payment.status) {
    case "open":
    case "pending":
    case "authorized":
      return { ok: true, target: "awaiting_payment", refundedCents };
    case "paid":
      return { ok: true, target: refundStatus(amount, refundedCents) ?? "paid", refundedCents };
    case "canceled":
      return { ok: true, target: "cancelled", refundedCents };
    case "expired":
      return { ok: true, target: "expired", refundedCents };
    case "failed":
      return { ok: true, target: "failed", refundedCents };
  }
}
