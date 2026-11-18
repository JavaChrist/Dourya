import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Marketing unsubscribe tokens: payload + HMAC-SHA256 (EMAIL_UNSUBSCRIBE_SECRET).
 * The token holds no e-mail in clear (only its SHA-256) and does not expire:
 * an unsubscribe link must keep working. It only ever turns marketing off,
 * never the transactional or security e-mails.
 */
export type MarketingList = "newsletter";

export type UnsubscribePayload = { v: 1; list: MarketingList; emailHash: string; uid?: string };

const MAX_TOKEN = 600;

/** Normalised SHA-256 of an address: used as id for suppressions and logs (no address in clear). */
export function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createUnsubscribeToken(payload: Omit<UnsubscribePayload, "v">, secret: string): string {
  if (secret.length < 32) throw new Error("EMAIL_UNSUBSCRIBE_SECRET must be at least 32 characters");
  const body: { v: 1; l: MarketingList; h: string; u?: string } = { v: 1, l: payload.list, h: payload.emailHash };
  if (payload.uid) body.u = payload.uid;
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

export function verifyUnsubscribeToken(token: string | null | undefined, secret: string | undefined): UnsubscribePayload | null {
  if (!token || !secret || secret.length < 32 || token.length > MAX_TOKEN) return null;
  const [data, signature, extra] = token.split(".");
  if (!data || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(data, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const body = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as { v?: unknown; l?: unknown; h?: unknown; u?: unknown };
    if (body.v !== 1 || body.l !== "newsletter" || typeof body.h !== "string" || !/^[a-f0-9]{64}$/.test(body.h)) return null;
    if (body.u !== undefined && (typeof body.u !== "string" || !/^[A-Za-z0-9]{1,128}$/.test(body.u))) return null;
    return { v: 1, list: "newsletter", emailHash: body.h, ...(body.u ? { uid: body.u } : {}) };
  } catch {
    return null;
  }
}

/** RFC 2369 + RFC 8058 headers, for marketing e-mails only. */
export function listUnsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  return { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}
