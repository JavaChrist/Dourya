/**
 * Validates the `next` parameter after sign-in: only a same-site relative path,
 * so a crafted link can never send the user to another site (open redirect).
 */
export function safeNext(value: string | null | undefined, fallback = "/mon-compte"): string {
  if (!value || typeof value !== "string") return fallback;
  if (value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, "http://dourya.local");
    if (url.origin !== "http://dourya.local") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

/**
 * Where to go after a successful sign-in. An admin is recognised by the role of
 * the account (Firebase custom claim), whatever the form or the device: from the
 * normal /connexion page too, it lands on /admin (or the /admin page it asked
 * for). Customers keep the safe `next` path.
 */
export function postSignInPath(role: string, next?: string | null): string {
  if (role !== "admin") return safeNext(next);
  const target = safeNext(next, "/admin");
  return target === "/admin" || target.startsWith("/admin/") || target.startsWith("/admin?") ? target : "/admin";
}
