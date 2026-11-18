import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { adminAuth } from "@/lib/firebase/admin-auth";
import { errorCode, logEvent } from "@/lib/log";
import { SESSION_COOKIE } from "./config";
import { resolveSession, type SessionAuth, type SessionState } from "./session-core";
import type { SessionUser } from "./roles";

/**
 * Data Access Layer: the only place that reads the session. Every page, action
 * and route handler that touches account or admin data goes through it
 * (the proxy check is only an optimistic redirect).
 * Must be called inside a <Suspense> boundary (cookies() is request data).
 */
export const getSession = cache(async (): Promise<SessionState> => {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return { status: "none" };
  // The check reads the clock (token expiry) and the revocation state: always at request time,
  // never during a (runtime) prefetch prerender.
  await connection();
  try {
    return await resolveSession(adminAuth() as unknown as SessionAuth, value);
  } catch (error) {
    logEvent("session_check_failed", { code: errorCode(error) });
    return { status: "invalid" };
  }
});

export async function getSessionUser(): Promise<SessionUser | null> {
  const state = await getSession();
  return state.status === "ok" ? state.user : null;
}

/** Customer area: a visitor is sent to the sign-in page (with the reason when the session expired). */
export async function requireUser(next = "/mon-compte"): Promise<SessionUser> {
  const state = await getSession();
  if (state.status === "ok") return state.user;
  const params = new URLSearchParams({ next });
  if (state.status === "expired") params.set("raison", "session-expiree");
  redirect(`/connexion?${params}`);
}

/** Admin area: a visitor goes to the admin sign-in; a signed-in customer gets a 404 (the admin is not revealed). */
export async function requireAdmin(): Promise<SessionUser> {
  const state = await getSession();
  if (state.status !== "ok") redirect(state.status === "expired" ? "/admin/connexion?raison=session-expiree" : "/admin/connexion");
  if (state.user.role !== "admin") notFound();
  return state.user;
}
