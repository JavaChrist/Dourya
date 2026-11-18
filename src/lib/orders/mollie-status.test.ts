import { describe, expect, it } from "vitest";
import { amountToCents, centsToAmount, interpretMolliePayment, type MolliePaymentView } from "./mollie-status";

const ORDER = { id: "ord_test_1", totalCents: 2450 };
const payment = (over: Partial<MolliePaymentView> = {}): MolliePaymentView => ({
  id: "tr_test",
  status: "paid",
  amount: { currency: "EUR", value: "24.50" },
  metadata: { orderId: ORDER.id },
  ...over,
});

describe("amounts", () => {
  it("converts without floating point", () => {
    expect(amountToCents("24.50")).toBe(2450);
    expect(amountToCents("0.10")).toBe(10);
    expect(amountToCents("1234567.89")).toBe(123456789);
    expect(centsToAmount(2450)).toBe("24.50");
    expect(centsToAmount(5)).toBe("0.05");
    expect(centsToAmount(0)).toBe("0.00");
  });
  it("rejects malformed amounts", () => {
    for (const v of ["24.5", "24", "-1.00", "1e3", "24,50", ""]) expect(amountToCents(v)).toBeNull();
    expect(() => centsToAmount(-1)).toThrow();
    expect(() => centsToAmount(1.5)).toThrow();
  });
});

describe("interpretMolliePayment", () => {
  it("maps every Mollie status", () => {
    const cases = [
      ["open", "awaiting_payment"],
      ["pending", "awaiting_payment"],
      ["authorized", "awaiting_payment"],
      ["paid", "paid"],
      ["canceled", "cancelled"],
      ["expired", "expired"],
      ["failed", "failed"],
    ] as const;
    for (const [status, target] of cases) {
      expect(interpretMolliePayment(payment({ status }), ORDER)).toEqual({ ok: true, target, refundedCents: 0 });
    }
  });
  it("derives partial and full refunds from the refunded amount", () => {
    expect(interpretMolliePayment(payment({ amountRefunded: { currency: "EUR", value: "5.00" } }), ORDER)).toEqual({
      ok: true,
      target: "partially_refunded",
      refundedCents: 500,
    });
    expect(interpretMolliePayment(payment({ amountRefunded: { currency: "EUR", value: "24.50" } }), ORDER)).toMatchObject({ target: "refunded" });
  });
  it("flags a payment that does not match the order", () => {
    expect(interpretMolliePayment(payment({ metadata: { orderId: "other" } }), ORDER)).toEqual({ ok: false, anomaly: "order_mismatch" });
    expect(interpretMolliePayment(payment({ metadata: null }), ORDER)).toEqual({ ok: false, anomaly: "order_mismatch" });
    expect(interpretMolliePayment(payment({ amount: { currency: "USD", value: "24.50" } }), ORDER)).toEqual({ ok: false, anomaly: "currency_mismatch" });
    expect(interpretMolliePayment(payment({ amount: { currency: "EUR", value: "1.00" } }), ORDER)).toEqual({ ok: false, anomaly: "amount_mismatch" });
  });
});
