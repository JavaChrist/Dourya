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

/**
 * Google sign-in (popup) errors. Returns null when the visitor closed the popup:
 * that is a choice, not an error to show.
 */
export function googleSignInErrorMessage(error: unknown): string | null {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled") return null;
  if (code === "auth/popup-blocked") return "La fenêtre Google a été bloquée par le navigateur. Autorisez les fenêtres pop-up pour ce site, puis réessayez.";
  if (code === "auth/account-exists-with-different-credential") return "Un compte existe déjà avec cette adresse. Connectez-vous avec votre e-mail et votre mot de passe.";
  if (code === "auth/too-many-requests") return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (code === "auth/network-request-failed") return "Connexion impossible. Vérifiez votre réseau puis réessayez.";
  if (code === "auth/operation-not-allowed" || code === "auth/unauthorized-domain") return "La connexion avec Google n'est pas encore disponible. Utilisez votre e-mail et votre mot de passe.";
  return "La connexion avec Google n'a pas abouti. Réessayez plus tard.";
}
