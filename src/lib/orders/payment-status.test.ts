import { describe, expect, it } from "vitest";
import { interpretPayment, type PaymentView } from "./payment-status";

const ORDER = { id: "ord_test_1", totalCents: 2450 };
const payment = (over: Partial<PaymentView> = {}): PaymentView => ({
  id: "cs_test_x",
  status: "paid",
  amountCents: 2450,
  currency: "eur",
  refundedCents: 0,
  orderId: ORDER.id,
  ...over,
});

describe("interpretPayment", () => {
  it("maps every payment status", () => {
    const cases = [
      ["open", "awaiting_payment"],
      ["pending", "awaiting_payment"],
      ["paid", "paid"],
      ["cancelled", "cancelled"],
      ["expired", "expired"],
      ["failed", "failed"],
    ] as const;
    for (const [status, target] of cases) {
      expect(interpretPayment(payment({ status }), ORDER)).toEqual({ ok: true, target, refundedCents: 0 });
    }
  });
  it("derives partial and full refunds from the refunded amount", () => {
    expect(interpretPayment(payment({ refundedCents: 500 }), ORDER)).toEqual({ ok: true, target: "partially_refunded", refundedCents: 500 });
    expect(interpretPayment(payment({ refundedCents: 2450 }), ORDER)).toMatchObject({ target: "refunded" });
  });
  it("flags a payment that does not match the order", () => {
    expect(interpretPayment(payment({ orderId: "other" }), ORDER)).toEqual({ ok: false, anomaly: "order_mismatch" });
    expect(interpretPayment(payment({ orderId: null }), ORDER)).toEqual({ ok: false, anomaly: "order_mismatch" });
    expect(interpretPayment(payment({ currency: "usd" }), ORDER)).toEqual({ ok: false, anomaly: "currency_mismatch" });
    expect(interpretPayment(payment({ amountCents: 100 }), ORDER)).toEqual({ ok: false, anomaly: "amount_mismatch" });
    expect(interpretPayment(payment({ amountCents: 24.5 }), ORDER)).toEqual({ ok: false, anomaly: "invalid_amount" });
    expect(interpretPayment(payment({ refundedCents: -1 }), ORDER)).toEqual({ ok: false, anomaly: "invalid_amount" });
  });
});
