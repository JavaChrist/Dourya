import { configuredSiteUrl } from "@/config/site";

/**
 * Maps Firebase Auth client errors to messages that reveal nothing:
 * never whether an e-mail has an account, never which field was wrong.
 */
export function signInErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "auth/too-many-requests") return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (code === "auth/network-request-failed") return "Connexion impossible. Vérifiez votre réseau puis réessayez.";
  return "Adresse e-mail ou mot de passe incorrect.";
}

export function isCode(error: unknown, code: string): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === code;
}

/**
 * Absolute URL of a page of this site, for the links inside Firebase e-mails.
 * Uses NEXT_PUBLIC_SITE_URL so the links always point to the main domain;
 * the current origin is the fallback when the variable is not set.
 * The domain must be listed in Firebase Auth > Authorized domains.
 */
export function siteUrl(path: string): string {
  return new URL(path, configuredSiteUrl() ?? window.location.origin).toString();
}
