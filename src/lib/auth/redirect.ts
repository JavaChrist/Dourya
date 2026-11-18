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
