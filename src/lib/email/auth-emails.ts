import "server-only";
import { siteOrigin } from "@/config/site";
import { adminAuth } from "@/lib/firebase/admin-auth";
import { errorCode, logEvent } from "@/lib/log";
import { allowAll, clientIp } from "@/lib/security/limit";
import { readEmailConfig } from "./config";
import { toSiteActionLink } from "./links";
import { sendEmail } from "./send";
import { emailHash } from "./unsubscribe";

/**
 * - "sent": the DOURYA e-mail went out (or into the test outbox).
 * - "use_firebase": custom e-mails are off (EMAIL_TRANSPORT=firebase): the browser
 *   keeps sending the Firebase e-mail, as before lot 3 bis.
 * - "rate_limited": too many requests for this IP or this account / address.
 * - "failed": nothing was sent (configuration, provider or Firebase error).
 */
export type DeliveryStatus = "sent" | "use_firebase" | "rate_limited" | "failed";

/** Verification e-mail for an account whose address is not confirmed yet. */
export async function deliverVerificationEmail(user: { uid: string; email: string }): Promise<DeliveryStatus> {
  if (!user.email) return "failed";
  const ip = await clientIp();
  const allowed = await allowAll([
    ["email:verify:ip", `ip:${ip}`],
    ["email:verify:uid", `uid:${user.uid}`],
  ]);
  if (!allowed) return "rate_limited";
  if (readEmailConfig().mode === "firebase") return "use_firebase";
  let link: string | null;
  try {
    link = toSiteActionLink(await adminAuth().generateEmailVerificationLink(user.email), siteOrigin(), "verifyEmail");
  } catch (error) {
    logEvent("email_link_failed", { type: "auth-verify-email", error: errorCode(error) });
    return "failed";
  }
  if (!link) {
    logEvent("email_link_failed", { type: "auth-verify-email", error: "unexpected_link" });
    return "failed";
  }
  const outcome = await sendEmail("auth-verify-email", user.email, { actionUrl: link }, { uid: user.uid });
  return outcome.status === "sent" ? "sent" : outcome.status === "disabled" ? "use_firebase" : "failed";
}

export type ResetStatus = "done" | "use_firebase" | "rate_limited";

/**
 * Password reset request. The answer never says whether the address has an
 * account: unknown address, disabled account or provider error all return "done".
 */
export async function deliverPasswordReset(email: string): Promise<ResetStatus> {
  const address = email.trim().toLowerCase();
  const ip = await clientIp();
  const allowed = await allowAll([
    ["email:reset:ip", `ip:${ip}`],
    ["email:reset:address", `addr:${emailHash(address)}`],
  ]);
  if (!allowed) return "rate_limited";
  if (readEmailConfig().mode === "firebase") return "use_firebase";
  let link: string | null = null;
  try {
    link = toSiteActionLink(await adminAuth().generatePasswordResetLink(address), siteOrigin(), "resetPassword");
  } catch (error) {
    const code = errorCode(error);
    // An unknown address is expected and not logged as an error (and never with the address).
    if (code !== "auth/user-not-found" && code !== "auth/email-not-found") logEvent("email_link_failed", { type: "auth-reset-password", error: code });
    return "done";
  }
  if (!link) {
    logEvent("email_link_failed", { type: "auth-reset-password", error: "unexpected_link" });
    return "done";
  }
  await sendEmail("auth-reset-password", address, { actionUrl: link });
  return "done";
}
