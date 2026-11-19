"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureProfile } from "@/lib/account/repository";
import { deliverVerificationEmail, type DeliveryStatus } from "@/lib/email/auth-emails";
import { adminAuth } from "@/lib/firebase/admin-auth";
import { errorCode, logEvent } from "@/lib/log";
import { allowAction } from "@/lib/security/limit";
import { SESSION_COOKIE, SESSION_COOKIE_NAMES, SESSION_MAX_AGE_SECONDS, type SessionScope } from "./config";
import { getSession } from "./dal";
import { postSignInPath } from "./redirect";
import { startSession, type SessionAuth } from "./session-core";

export type StartSessionResponse =
  | { ok: true; redirectTo: string }
  | { ok: false; error: "credentials" | "stale" | "rate_limited" | "unavailable" }
  /** Address not confirmed: a new link is sent by the server ("use_firebase": the browser sends the Firebase e-mail). */
  | { ok: false; error: "unverified"; verification: DeliveryStatus };

/**
 * Called by the sign-in forms after Firebase has checked the password in the browser.
 * Server Actions are POST only and Next checks the Origin header against the host (CSRF).
 */
export async function startSessionAction(idToken: string, scope: SessionScope, next?: string): Promise<StartSessionResponse> {
  if (scope !== "customer" && scope !== "admin") return { ok: false, error: "credentials" };
  if (!(await allowAction(scope === "admin" ? "session:admin" : "session:customer"))) return { ok: false, error: "rate_limited" };

  let result;
  try {
    result = await startSession(adminAuth() as unknown as SessionAuth, idToken, scope);
  } catch (error) {
    logEvent("session_start_error", { code: errorCode(error) });
    return { ok: false, error: "unavailable" };
  }

  if (!result.ok) {
    logEvent("session_refused", { scope, reason: result.reason });
    // A non-admin on the admin form gets the same answer as a wrong password.
    if (result.reason === "forbidden" || result.reason === "invalid") return { ok: false, error: "credentials" };
    if (result.reason === "unverified") {
      const verification = await deliverVerificationEmail(result.user).catch((error) => {
        logEvent("verification_email_error", { code: errorCode(error) });
        return "failed" as const;
      });
      return { ok: false, error: "unverified", verification };
    }
    return { ok: false, error: result.reason };
  }

  try {
    await ensureProfile(result.user.uid, result.user.email);
  } catch (error) {
    logEvent("profile_init_error", { code: errorCode(error) });
    return { ok: false, error: "unavailable" };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, result.cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return { ok: true, redirectTo: postSignInPath(result.user.role, next) };
}

async function clearSessionCookies() {
  const jar = await cookies();
  for (const name of SESSION_COOKIE_NAMES) if (jar.has(name)) jar.delete(name);
}

/** Sign out on this device: the cookie is deleted. */
export async function signOutAction(formData?: FormData): Promise<void> {
  const target = formData?.get("scope") === "admin" ? "/admin/connexion" : "/connexion";
  await clearSessionCookies();
  redirect(`${target}?raison=deconnecte`);
}

/** Sign out everywhere: revokes every session of the account (all devices), then deletes the cookie. */
export async function signOutEverywhereAction(): Promise<void> {
  const state = await getSession();
  if (state.status === "ok") {
    try {
      await adminAuth().revokeRefreshTokens(state.user.uid);
    } catch (error) {
      logEvent("revoke_error", { code: errorCode(error) });
    }
  }
  await clearSessionCookies();
  redirect("/connexion?raison=deconnecte");
}
