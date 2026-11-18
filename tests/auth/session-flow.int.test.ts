import { beforeAll, describe, expect, it } from "vitest";
import { adminAuth } from "@/lib/firebase/admin";
import { resolveSession, startSession, type SessionAuth } from "@/lib/auth/session-core";
import { setRole, showRole } from "../../scripts/lib/admin-role.mjs";
import {
  applyEmailVerification,
  clearAuth,
  lastOobCode,
  nextSecond,
  resetPassword,
  sendPasswordReset,
  sendVerifyEmail,
  signIn,
  signUp,
} from "../helpers/auth-emulator";

/**
 * End-to-end session flow on the Auth emulator, with the real Admin SDK:
 * the same code path as startSessionAction and the DAL, minus the cookie header.
 */
const auth = () => adminAuth() as unknown as SessionAuth;
const PASSWORD = "une phrase de passe solide";

async function verifiedCustomer(email: string) {
  const { idToken, localId } = await signUp(email, PASSWORD);
  await sendVerifyEmail(idToken);
  await applyEmailVerification(await lastOobCode(email, "VERIFY_EMAIL"));
  return localId;
}

beforeAll(async () => {
  await clearAuth();
});

describe("sign-up and e-mail verification", () => {
  it("an unverified account gets no session, then signs in once verified", async () => {
    const email = "nouvelle@example.test";
    const { idToken } = await signUp(email, PASSWORD);
    expect(await startSession(auth(), idToken, "customer")).toEqual({ ok: false, reason: "unverified" });

    await sendVerifyEmail(idToken);
    await applyEmailVerification(await lastOobCode(email, "VERIFY_EMAIL"));

    const fresh = await signIn(email, PASSWORD);
    const result = await startSession(auth(), fresh.idToken, "customer");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user).toMatchObject({ email, emailVerified: true, role: "customer" });

    const state = await resolveSession(auth(), result.cookie);
    expect(state).toMatchObject({ status: "ok", user: { email, role: "customer" } });
  });
});

describe("login and logout", () => {
  it("a forged or empty cookie is refused", async () => {
    expect(await resolveSession(auth(), undefined)).toEqual({ status: "none" });
    expect(await resolveSession(auth(), "forged.cookie.value")).toEqual({ status: "invalid" });
    expect(await startSession(auth(), "x".repeat(40), "customer")).toEqual({ ok: false, reason: "invalid" });
  });

  it("an old sign-in (over 5 minutes) must authenticate again", async () => {
    const email = "ancienne@example.test";
    await verifiedCustomer(email);
    const { idToken } = await signIn(email, PASSWORD);
    const in10Minutes = Math.floor(Date.now() / 1000) + 600;
    expect(await startSession(auth(), idToken, "customer", in10Minutes)).toEqual({ ok: false, reason: "stale" });
  });

  it("'sign out everywhere' revokes the session cookie", async () => {
    const email = "partout@example.test";
    const uid = await verifiedCustomer(email);
    const result = await startSession(auth(), (await signIn(email, PASSWORD)).idToken, "customer");
    if (!result.ok) throw new Error("session expected");
    expect((await resolveSession(auth(), result.cookie)).status).toBe("ok");

    await nextSecond();
    await adminAuth().revokeRefreshTokens(uid);
    expect(await resolveSession(auth(), result.cookie)).toEqual({ status: "invalid" });
  });

  it("a disabled account loses its session", async () => {
    const email = "desactivee@example.test";
    const uid = await verifiedCustomer(email);
    const result = await startSession(auth(), (await signIn(email, PASSWORD)).idToken, "customer");
    if (!result.ok) throw new Error("session expected");
    await adminAuth().updateUser(uid, { disabled: true });
    expect(await resolveSession(auth(), result.cookie)).toEqual({ status: "invalid" });
  });
});

describe("password reset", () => {
  it("the reset link changes the password: the old one no longer works", async () => {
    const email = "oubli@example.test";
    await verifiedCustomer(email);
    await sendPasswordReset(email);
    await resetPassword(await lastOobCode(email, "PASSWORD_RESET"), "un tout nouveau mot de passe");

    await expect(signIn(email, PASSWORD)).rejects.toThrow();
    const { idToken } = await signIn(email, "un tout nouveau mot de passe");
    expect((await startSession(auth(), idToken, "customer")).ok).toBe(true);
  });
});

describe("admin access and the admin-role script", () => {
  it("a customer cannot open an admin session", async () => {
    const email = "cliente@example.test";
    await verifiedCustomer(email);
    const { idToken } = await signIn(email, PASSWORD);
    expect(await startSession(auth(), idToken, "admin")).toEqual({ ok: false, reason: "forbidden" });
  });

  it("grant: the admin role comes from the custom claim and old sessions are revoked", async () => {
    const email = "equipe@example.test";
    await verifiedCustomer(email);
    const before = await startSession(auth(), (await signIn(email, PASSWORD)).idToken, "customer");
    if (!before.ok) throw new Error("session expected");

    await nextSecond();
    expect(await setRole(adminAuth(), email, "admin")).toMatchObject({ role: "admin", changed: true });
    expect(await setRole(adminAuth(), email, "admin")).toMatchObject({ changed: false });
    expect(await showRole(adminAuth(), email)).toMatchObject({ role: "admin" });
    // The customer session opened before the grant is revoked.
    expect(await resolveSession(auth(), before.cookie)).toEqual({ status: "invalid" });

    await nextSecond();
    const admin = await startSession(auth(), (await signIn(email, PASSWORD)).idToken, "admin");
    expect(admin.ok).toBe(true);
    if (!admin.ok) return;
    expect(await resolveSession(auth(), admin.cookie)).toMatchObject({ status: "ok", user: { role: "admin" } });

    // Revoke: back to customer, the admin session stops at once.
    await nextSecond();
    expect(await setRole(adminAuth(), email, "customer")).toMatchObject({ role: "customer", changed: true });
    expect(await resolveSession(auth(), admin.cookie)).toEqual({ status: "invalid" });
    await nextSecond();
    expect(await startSession(auth(), (await signIn(email, PASSWORD)).idToken, "admin")).toEqual({ ok: false, reason: "forbidden" });
  });

  it("the script refuses an unknown e-mail or role", async () => {
    await expect(setRole(adminAuth(), "personne@example.test", "admin")).rejects.toMatchObject({ code: "auth/user-not-found" });
    // @ts-expect-error invalid role on purpose
    await expect(setRole(adminAuth(), "equipe@example.test", "superadmin")).rejects.toThrow("Unknown role");
  });
});
