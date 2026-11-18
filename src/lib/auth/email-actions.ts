"use server";

import { deliverPasswordReset, deliverVerificationEmail, type DeliveryStatus, type ResetStatus } from "@/lib/email/auth-emails";
import { adminAuth } from "@/lib/firebase/admin";
import { errorCode, logEvent } from "@/lib/log";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends the welcome / verification e-mail right after sign-up. The fresh ID token
 * proves the caller owns the new account; nothing is sent for a confirmed address.
 */
export async function sendVerificationEmailAction(idToken: string): Promise<{ status: DeliveryStatus }> {
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 4096) return { status: "failed" };
  let user: { uid: string; email: string; verified: boolean };
  try {
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    user = { uid: decoded.uid, email: decoded.email ?? "", verified: decoded.email_verified === true };
  } catch (error) {
    logEvent("verification_email_refused", { code: errorCode(error) });
    return { status: "failed" };
  }
  if (user.verified) return { status: "sent" };
  try {
    return { status: await deliverVerificationEmail(user) };
  } catch (error) {
    logEvent("verification_email_error", { code: errorCode(error) });
    return { status: "failed" };
  }
}

/** Password reset request: same answer whether the address has an account or not. */
export async function requestPasswordResetAction(email: string): Promise<{ status: ResetStatus | "invalid" }> {
  if (typeof email !== "string") return { status: "invalid" };
  const address = email.trim();
  if (!EMAIL.test(address) || address.length > 254) return { status: "invalid" };
  try {
    return { status: await deliverPasswordReset(address) };
  } catch (error) {
    logEvent("reset_email_error", { code: errorCode(error) });
    return { status: "done" };
  }
}
