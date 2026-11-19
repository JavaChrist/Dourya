/**
 * Admin sign-in e-mail remembered on this device (localStorage), so the admin
 * form comes prefilled. Saved only after a successful admin sign-in; never in
 * the code, the page or a cookie. Every access is guarded: private windows or
 * blocked storage simply mean "nothing remembered".
 */
export const ADMIN_EMAIL_KEY = "dourya:admin-email";
const EVENT = "dourya:admin-email-change";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readRememberedAdminEmail(): string | null {
  try {
    const value = storage()?.getItem(ADMIN_EMAIL_KEY) ?? null;
    return value && EMAIL.test(value) && value.length <= 254 ? value : null;
  } catch {
    return null;
  }
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function rememberAdminEmail(email: string): void {
  const value = email.trim().toLowerCase();
  if (!EMAIL.test(value) || value.length > 254) return;
  try {
    storage()?.setItem(ADMIN_EMAIL_KEY, value);
  } catch {
    return;
  }
  notify();
}

export function forgetAdminEmail(): void {
  try {
    storage()?.removeItem(ADMIN_EMAIL_KEY);
  } catch {
    return;
  }
  notify();
}

/** For useSyncExternalStore: this tab's changes (custom event) and other tabs' (storage event). */
export function subscribeRememberedAdminEmail(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
