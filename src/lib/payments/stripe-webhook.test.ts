import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseStripeEvent, verifyStripeSignature } from "./stripe-webhook";

// Fictitious secret, never a real endpoint secret.
const SECRET = `whsec_${"t".repeat(24)}`;
const NOW = 1_800_000_000;
const sign = (raw: string, t = NOW, secret = SECRET) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex")}`;

describe("verifyStripeSignature", () => {
  const raw = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

  it("accepts a valid signature, also among several v1 values", () => {
    expect(verifyStripeSignature(raw, sign(raw), SECRET, NOW)).toBe(true);
    expect(verifyStripeSignature(raw, `${sign(raw)},v1=${"0".repeat(64)}`, SECRET, NOW)).toBe(true);
    expect(verifyStripeSignature(raw, `t=${NOW},v1=${"0".repeat(64)},${sign(raw).split(",")[1]}`, SECRET, NOW)).toBe(true);
  });

  it("rejects a modified body, another secret, a missing or malformed header", () => {
    expect(verifyStripeSignature(`${raw} `, sign(raw), SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(raw, sign(raw, NOW, `whsec_${"o".repeat(24)}`), SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(raw, null, SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(raw, "garbage", SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(raw, `t=${NOW}`, SECRET, NOW)).toBe(false);
  });

  it("rejects a timestamp outside the 5-minute window", () => {
    expect(verifyStripeSignature(raw, sign(raw, NOW - 301), SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(raw, sign(raw, NOW + 301), SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(raw, sign(raw, NOW - 299), SECRET, NOW)).toBe(true);
  });
});

describe("parseStripeEvent", () => {
  const ev = (type: string, object: Record<string, unknown>) => JSON.stringify({ id: "evt_1", type, data: { object } });

  it("keeps the session id of checkout events", () => {
    for (const type of ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"]) {
      expect(parseStripeEvent(ev(type, { id: "cs_test_abc" }))).toEqual({ kind: "session", type, sessionId: "cs_test_abc" });
    }
  });

  it("keeps the PaymentIntent of a refund", () => {
    expect(parseStripeEvent(ev("charge.refunded", { id: "ch_1", payment_intent: "pi_123" }))).toEqual({ kind: "payment_intent", type: "charge.refunded", paymentIntentId: "pi_123" });
  });

  it("keeps the subscription and invoice ids of Mail Club events", () => {
    for (const type of ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]) {
      expect(parseStripeEvent(ev(type, { id: "sub_123" }))).toEqual({ kind: "subscription", type, subscriptionId: "sub_123" });
    }
    for (const type of ["invoice.paid", "invoice.payment_failed"]) {
      expect(parseStripeEvent(ev(type, { id: "in_123" }))).toEqual({ kind: "invoice", type, invoiceId: "in_123" });
    }
    expect(parseStripeEvent(ev("customer.subscription.updated", { id: "cus_1" }))).toMatchObject({ kind: "ignored" });
    expect(parseStripeEvent(ev("invoice.paid", { id: "sub_1" }))).toMatchObject({ kind: "ignored" });
    expect(parseStripeEvent(ev("invoice.created", { id: "in_1" }))).toEqual({ kind: "ignored", type: "invoice.created" });
  });

  it("ignores other events, bad ids and invalid JSON", () => {
    expect(parseStripeEvent(ev("customer.created", { id: "cus_1" }))).toEqual({ kind: "ignored", type: "customer.created" });
    expect(parseStripeEvent(ev("checkout.session.completed", { id: "../x" }))).toMatchObject({ kind: "ignored" });
    expect(parseStripeEvent("{nope")).toEqual({ kind: "ignored", type: null });
  });
});
