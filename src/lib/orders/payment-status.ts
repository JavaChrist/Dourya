import type { PaymentStatus } from "./types";
import { refundStatus } from "./transitions";

/**
 * A payment as re-read at the payment provider (Stripe Checkout Session),
 * reduced to what the shop needs. Amounts are integer cents: no floating
 * point on money.
 */
export type PaymentView = {
  /** Provider reference stored on the order (Stripe Checkout Session id). */
  id: string;
  status: "open" | "pending" | "paid" | "cancelled" | "expired" | "failed";
  amountCents: number;
  /** ISO code, any case ("eur" at Stripe). */
  currency: string;
  refundedCents: number;
  /** Order id carried by the provider metadata, null when absent. */
  orderId: string | null;
};

export type PaymentInterpretation =
  | { ok: true; target: PaymentStatus; refundedCents: number }
  /** The payment does not match the order: nothing is changed, the order is flagged. */
  | { ok: false; anomaly: "order_mismatch" | "currency_mismatch" | "amount_mismatch" | "invalid_amount" };

const isCents = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

/**
 * Turns a payment re-read at the provider into the order's target payment
 * state. A webhook body is never applied as such: only this re-read is used,
 * and only if the payment belongs to the order with the expected amount in EUR.
 */
export function interpretPayment(payment: PaymentView, order: { id: string; totalCents: number }): PaymentInterpretation {
  if (payment.orderId !== order.id) return { ok: false, anomaly: "order_mismatch" };
  if (payment.currency.toUpperCase() !== "EUR") return { ok: false, anomaly: "currency_mismatch" };
  if (!isCents(payment.amountCents) || !isCents(payment.refundedCents)) return { ok: false, anomaly: "invalid_amount" };
  if (payment.amountCents !== order.totalCents) return { ok: false, anomaly: "amount_mismatch" };
  const { refundedCents } = payment;

  switch (payment.status) {
    case "open":
    case "pending":
      return { ok: true, target: "awaiting_payment", refundedCents };
    case "paid":
      return { ok: true, target: refundStatus(payment.amountCents, refundedCents) ?? "paid", refundedCents };
    case "cancelled":
      return { ok: true, target: "cancelled", refundedCents };
    case "expired":
      return { ok: true, target: "expired", refundedCents };
    case "failed":
      return { ok: true, target: "failed", refundedCents };
  }
}
