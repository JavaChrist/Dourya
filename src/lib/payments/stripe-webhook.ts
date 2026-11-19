import { createHmac, timingSafeEqual } from "node:crypto";
import { isCheckoutSessionId, isPaymentIntentId } from "./stripe-client";

/**
 * Stripe webhook signature, as documented for `Stripe-Signature`
 * ("t=<unix>,v1=<hex>[,v1=<hex>...]"): HMAC-SHA256 of "<t>.<raw body>" keyed
 * with the endpoint secret. The raw body must be the exact bytes received.
 * Pure (no server-only import) so it can be unit-tested.
 */
export function verifyStripeSignature(raw: string, header: string | null, secret: string, nowSec: number, toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t" && /^\d{1,12}$/.test(value)) timestamp = Number(value);
    else if (key === "v1" && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) return false;
  // Replay window, both ways (clock skew).
  if (Math.abs(nowSec - timestamp) > toleranceSec) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${raw}`, "utf8").digest("hex"), "utf8");
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "utf8");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Events the shop acts on. Anything else is acknowledged and ignored. */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
] as const;

export type StripeEventRef =
  | { kind: "session"; type: string; sessionId: string }
  | { kind: "payment_intent"; type: string; paymentIntentId: string }
  | { kind: "ignored"; type: string | null };

/**
 * Reads only the type and the object reference from a verified event. The
 * event's own data (status, amounts) is never trusted: the session is always
 * re-read at Stripe afterwards.
 */
export function parseStripeEvent(raw: string): StripeEventRef {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { kind: "ignored", type: null };
  }
  const event = body && typeof body === "object" ? (body as { type?: unknown; data?: { object?: Record<string, unknown> } }) : null;
  const type = typeof event?.type === "string" ? event.type : null;
  if (!type || !(HANDLED_EVENTS as readonly string[]).includes(type)) return { kind: "ignored", type };
  const object = event?.data?.object;
  if (type === "charge.refunded") {
    const pi = object?.payment_intent;
    return isPaymentIntentId(pi) ? { kind: "payment_intent", type, paymentIntentId: pi } : { kind: "ignored", type };
  }
  return isCheckoutSessionId(object?.id) ? { kind: "session", type, sessionId: object.id } : { kind: "ignored", type };
}
