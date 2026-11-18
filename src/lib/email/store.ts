import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { EmailCategory, EmailType, TemplateOverride } from "./registry";
import { sanitizeOverride } from "./registry";

/**
 * Server-only collections (clients have no access, see firestore.rules):
 *   emailLog/{id}               one line per send: type, status, provider id, SHA-256 of the
 *                               address. Never the address, the link or the code. expiresAt
 *                               drives a Firestore TTL policy (90 days).
 *   emailSuppressions/{sha256}  addresses that must not get marketing e-mails
 *                               (unsubscribe, hard bounce, complaint). Never used for
 *                               security or transactional e-mails.
 *   emailTemplates/{type}       optional subject / preheader overrides (admin, later lot).
 */
export const EMAIL_LOG_TTL_DAYS = 90;

export type EmailLogEntry = {
  type: EmailType;
  category: EmailCategory;
  transport: "resend" | "test";
  status: "sent" | "failed" | "suppressed";
  toHash: string;
  uid?: string;
  providerId?: string;
  error?: string;
};

export async function writeEmailLog(entry: EmailLogEntry): Promise<void> {
  const clean = Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined));
  await adminDb()
    .collection("emailLog")
    .add({
      ...clean,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + EMAIL_LOG_TTL_DAYS * 24 * 60 * 60_000),
    });
}

/** Records a provider event (delivered, bounced...) on the matching log line, if any. */
export async function recordProviderEvent(providerId: string, event: string): Promise<void> {
  const snap = await adminDb().collection("emailLog").where("providerId", "==", providerId).limit(1).get();
  const doc = snap.docs[0];
  if (doc) await doc.ref.update({ lastEvent: event, lastEventAt: FieldValue.serverTimestamp() });
}

export type SuppressionReason = "unsubscribe" | "bounce" | "complaint" | "provider";

/** Marketing suppression. An unsubscribe never replaces a bounce or a complaint (those must stay). */
export async function addSuppression(toHash: string, reason: SuppressionReason): Promise<void> {
  const ref = adminDb().collection("emailSuppressions").doc(toHash);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && reason === "unsubscribe" && snap.get("reason") !== "unsubscribe") return;
    tx.set(ref, { scope: "marketing", reason, updatedAt: FieldValue.serverTimestamp() });
  });
}

/** Removes a suppression only when it came from an unsubscribe (bounces and complaints stay). */
export async function liftUnsubscribe(toHash: string): Promise<void> {
  const ref = adminDb().collection("emailSuppressions").doc(toHash);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.get("reason") === "unsubscribe") tx.delete(ref);
  });
}

export async function isSuppressed(toHash: string): Promise<boolean> {
  const snap = await adminDb().collection("emailSuppressions").doc(toHash).get();
  return snap.exists;
}

/** Override texts for a template; any read error falls back to the defaults in code. */
export async function loadTemplateOverride(type: EmailType): Promise<TemplateOverride> {
  try {
    const snap = await adminDb().collection("emailTemplates").doc(type).get();
    return snap.exists && snap.get("enabled") === true ? sanitizeOverride(snap.data()) : {};
  } catch {
    return {};
  }
}
