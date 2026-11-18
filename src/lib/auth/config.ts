/** Session cookie settings (server HttpOnly cookie created from a Firebase ID token). */
export const SESSION_MAX_AGE_SECONDS = 5 * 24 * 60 * 60; // 5 days (Firebase allows 5 min to 14 days)

/** A sign-in must be recent to open a session: limits the use of a stolen ID token. */
export const MAX_AUTH_AGE_SECONDS = 5 * 60;

/** `__Host-` forces Secure, path=/ and no Domain; it needs HTTPS, so dev on http://localhost uses a plain name. */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-dourya_session" : "dourya_session";

export const SESSION_COOKIE_NAMES = ["__Host-dourya_session", "dourya_session"] as const;

export type SessionScope = "customer" | "admin";
