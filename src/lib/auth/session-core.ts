import type { UserRole } from "@/lib/commerce-types";
import { MAX_AUTH_AGE_SECONDS, SESSION_MAX_AGE_SECONDS, type SessionScope } from "./config";
import { roleFromClaims, type SessionUser } from "./roles";

/** Decoded Firebase token fields used here (ID token or session cookie). */
export type DecodedToken = {
  uid: string;
  email?: string;
  email_verified?: boolean;
  auth_time: number;
  [claim: string]: unknown;
};

/** The subset of firebase-admin Auth used for sessions: injected so the logic is testable. */
export interface SessionAuth {
  verifyIdToken(idToken: string, checkRevoked?: boolean): Promise<DecodedToken>;
  createSessionCookie(idToken: string, options: { expiresIn: number }): Promise<string>;
  verifySessionCookie(cookie: string, checkRevoked?: boolean): Promise<DecodedToken>;
}

export type StartSessionResult =
  | { ok: true; cookie: string; user: SessionUser }
  | { ok: false; reason: "invalid" | "stale" | "forbidden" }
  /** The token is valid but the address is not confirmed: the user is returned to send a new link. */
  | { ok: false; reason: "unverified"; user: SessionUser };

function toUser(decoded: DecodedToken): SessionUser {
  return {
    uid: decoded.uid,
    email: decoded.email ?? "",
    emailVerified: decoded.email_verified === true,
    role: roleFromClaims(decoded) as UserRole,
  };
}

/**
 * Exchanges a fresh Firebase ID token for a session cookie value.
 * Refuses: invalid or revoked tokens, sign-ins older than 5 minutes, unverified
 * e-mails, and non-admin users asking for an admin session.
 */
export async function startSession(
  auth: SessionAuth,
  idToken: string,
  scope: SessionScope,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<StartSessionResult> {
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 4096) return { ok: false, reason: "invalid" };
  let decoded: DecodedToken;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (nowSeconds - decoded.auth_time > MAX_AUTH_AGE_SECONDS) return { ok: false, reason: "stale" };
  const user = toUser(decoded);
  if (scope === "admin" && user.role !== "admin") return { ok: false, reason: "forbidden" };
  if (!user.emailVerified) return { ok: false, reason: "unverified", user };
  try {
    const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_SECONDS * 1000 });
    return { ok: true, cookie, user };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export type SessionState =
  | { status: "none" }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "ok"; user: SessionUser };

/** Checks a session cookie, including revocation (sign-out everywhere, role revoked, disabled account). */
export async function resolveSession(auth: SessionAuth, cookie: string | undefined): Promise<SessionState> {
  if (!cookie) return { status: "none" };
  try {
    const decoded = await auth.verifySessionCookie(cookie, true);
    const user = toUser(decoded);
    return user.emailVerified ? { status: "ok", user } : { status: "invalid" };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    return code === "auth/session-cookie-expired" ? { status: "expired" } : { status: "invalid" };
  }
}
