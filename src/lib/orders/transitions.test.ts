import { describe, expect, it } from "vitest";
import { canFulfil, holdsStock, initialFulfilment, nextFulfilmentStatus, nextPaymentStatus, refundStatus, validateRefund } from "./transitions";

describe("nextPaymentStatus", () => {
  it("follows the normal path", () => {
    expect(nextPaymentStatus("draft", "awaiting_payment")).toEqual({ ok: true, changed: true, next: "awaiting_payment" });
    expect(nextPaymentStatus("awaiting_payment", "paid")).toEqual({ ok: true, changed: true, next: "paid" });
    expect(nextPaymentStatus("paid", "refunded")).toEqual({ ok: true, changed: true, next: "refunded" });
  });
  it("treats a repeated webhook as a no-op", () => {
    expect(nextPaymentStatus("paid", "paid")).toEqual({ ok: true, changed: false, next: "paid" });
    expect(nextPaymentStatus("failed", "failed")).toEqual({ ok: true, changed: false, next: "failed" });
  });
  it("never moves a paid order backwards", () => {
    for (const target of ["draft", "awaiting_payment", "failed", "expired", "cancelled"] as const) {
      expect(nextPaymentStatus("paid", target).ok).toBe(false);
    }
    expect(nextPaymentStatus("refunded", "paid").ok).toBe(false);
  });
  it("accepts a late payment but asks for a stock check", () => {
    expect(nextPaymentStatus("expired", "paid")).toMatchObject({ ok: true, changed: true, needsReview: "late_payment_check_stock" });
    expect(nextPaymentStatus("failed", "paid").ok).toBe(false);
  });
  it("lets a partial refund grow", () => {
    expect(nextPaymentStatus("partially_refunded", "partially_refunded")).toMatchObject({ ok: true, changed: true });
  });
});

describe("stock and fulfilment helpers", () => {
  it("holds stock only while the order can still be paid or is paid", () => {
    expect(holdsStock("awaiting_payment")).toBe(true);
    expect(holdsStock("expired")).toBe(false);
    expect(holdsStock("refunded")).toBe(false);
    expect(canFulfil("partially_refunded")).toBe(true);
    expect(canFulfil("refunded")).toBe(false);
  });
  it("starts with production when an item is made to order", () => {
    expect(initialFulfilment([{ stockMode: "stocked" }, { stockMode: "made_to_order" }])).toBe("to_produce");
    expect(initialFulfilment([{ stockMode: "stocked" }])).toBe("preparing");
  });
});

describe("nextFulfilmentStatus", () => {
  const ctx = { paymentStatus: "paid" as const, hasTracking: false, trackedService: false };
  it("moves forward step by step", () => {
    expect(nextFulfilmentStatus("to_produce", "preparing", ctx)).toMatchObject({ ok: true, next: "preparing" });
    expect(nextFulfilmentStatus("to_produce", "shipped", ctx).ok).toBe(false);
    expect(nextFulfilmentStatus(null, "preparing", ctx)).toEqual({ ok: false, reason: "fulfilment_not_started" });
  });
  it("needs a tracking number to ship a tracked parcel", () => {
    expect(nextFulfilmentStatus("ready", "shipped", { ...ctx, trackedService: true })).toEqual({ ok: false, reason: "tracking_required" });
    expect(nextFulfilmentStatus("ready", "shipped", { ...ctx, trackedService: true, hasTracking: true }).ok).toBe(true);
    expect(nextFulfilmentStatus("ready", "shipped", ctx).ok).toBe(true);
  });
  it("marks delivered only with a proof", () => {
    expect(nextFulfilmentStatus("shipped", "delivered", ctx)).toEqual({ ok: false, reason: "delivery_proof_required" });
    expect(nextFulfilmentStatus("shipped", "delivered", { ...ctx, proof: { kind: "tracking" } })).toEqual({ ok: false, reason: "tracking_required" });
    expect(nextFulfilmentStatus("shipped", "delivered", { ...ctx, proof: { kind: "manual_confirmation", adminUid: "a" } }).ok).toBe(true);
  });
  it("blocks preparation after a full refund but still records a return", () => {
    expect(nextFulfilmentStatus("preparing", "ready", { ...ctx, paymentStatus: "refunded" }).ok).toBe(false);
    expect(nextFulfilmentStatus("shipped", "returned", { ...ctx, paymentStatus: "refunded" }).ok).toBe(true);
  });
});

describe("refunds", () => {
  it("derives the state from the refunded amount", () => {
    expect(refundStatus(2000, 0)).toBeNull();
    expect(refundStatus(2000, 500)).toBe("partially_refunded");
    expect(refundStatus(2000, 2000)).toBe("refunded");
  });
  it("refuses a refund above what is left", () => {
    const order = { paymentStatus: "partially_refunded" as const, totalCents: 2000, refundedCents: 1500 };
    expect(validateRefund(order, 500)).toEqual({ ok: true });
    expect(validateRefund(order, 501)).toEqual({ ok: false, reason: "amount_above_remaining" });
    expect(validateRefund(order, 0)).toEqual({ ok: false, reason: "invalid_amount" });
    expect(validateRefund(order, 1.5)).toEqual({ ok: false, reason: "invalid_amount" });
    expect(validateRefund({ ...order, paymentStatus: "awaiting_payment" }, 100)).toEqual({ ok: false, reason: "not_refundable" });
  });
});
