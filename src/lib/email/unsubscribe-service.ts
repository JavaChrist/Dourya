import "server-only";
import { withdrawNewsletterConsent, type ConsentSource } from "@/lib/account/repository";
import { errorCode, logEvent } from "@/lib/log";
import { allowAction } from "@/lib/security/limit";
import { addSuppression } from "./store";
import { verifyUnsubscribeToken, type UnsubscribePayload } from "./unsubscribe";

export type UnsubscribeResult = "done" | "invalid" | "rate_limited" | "unavailable";

function secret(): string | null {
  const value = process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "";
  return value.length >= 32 ? value : null;
}

/** Checks a token without changing anything (used to show the confirmation page). */
export function readUnsubscribeToken(token: unknown): UnsubscribePayload | null | "unavailable" {
  const key = secret();
  if (!key) return "unavailable";
  return typeof token === "string" ? verifyUnsubscribeToken(token, key) : null;
}

/**
 * Marketing unsubscribe: suppresses the address for marketing only and withdraws the
 * newsletter consent of the account named in the token. Security and transactional
 * e-mails are never affected. Logs never carry the token or the address.
 */
export async function unsubscribe(token: unknown, source: Exclude<ConsentSource, "account">): Promise<UnsubscribeResult> {
  const payload = readUnsubscribeToken(token);
  if (payload === "unavailable") {
    logEvent("email_config_missing", { type: "unsubscribe", missing: "EMAIL_UNSUBSCRIBE_SECRET" });
    return "unavailable";
  }
  if (!(await allowAction("email:unsubscribe"))) return "rate_limited";
  if (!payload) return "invalid";
  try {
    await addSuppression(payload.emailHash, "unsubscribe");
    if (payload.uid) await withdrawNewsletterConsent(payload.uid, source);
  } catch (error) {
    logEvent("unsubscribe_failed", { error: errorCode(error) });
    return "unavailable";
  }
  logEvent("unsubscribed", { list: payload.list, source });
  return "done";
}
