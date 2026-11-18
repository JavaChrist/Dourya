import { describe, expect, it } from "vitest";
import { resolveSession, startSession, type DecodedToken, type SessionAuth } from "./session-core";

const NOW = 1_800_000_000;
const TOKEN = "x".repeat(40);

function fakeAuth(decoded: Partial<DecodedToken> | Error, cookieError?: { code: string }): SessionAuth {
  const full = decoded instanceof Error ? decoded : ({ uid: "u1", email: "u1@test.local", email_verified: true, auth_time: NOW - 10, ...decoded } as DecodedToken);
  return {
    async verifyIdToken() {
      if (full instanceof Error) throw full;
      return full;
    },
    async createSessionCookie() {
      return "session-cookie-value";
    },
    async verifySessionCookie() {
      if (cookieError) throw Object.assign(new Error("x"), cookieError);
      if (full instanceof Error) throw full;
      return full;
    },
  };
}

describe("startSession", () => {
  it("opens a customer session for a fresh, verified sign-in", async () => {
    const r = await startSession(fakeAuth({}), TOKEN, "customer", NOW);
    expect(r).toMatchObject({ ok: true, cookie: "session-cookie-value", user: { uid: "u1", role: "customer" } });
  });
  it("refuses an invalid token", async () => {
    expect(await startSession(fakeAuth(new Error("bad")), TOKEN, "customer", NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(await startSession(fakeAuth({}), "short", "customer", NOW)).toEqual({ ok: false, reason: "invalid" });
  });
  it("refuses an old sign-in (stolen token replay)", async () => {
    expect(await startSession(fakeAuth({ auth_time: NOW - 600 }), TOKEN, "customer", NOW)).toEqual({ ok: false, reason: "stale" });
  });
  it("refuses an unverified e-mail", async () => {
    expect(await startSession(fakeAuth({ email_verified: false }), TOKEN, "customer", NOW)).toEqual({ ok: false, reason: "unverified" });
  });
  it("refuses an admin session to a customer", async () => {
    expect(await startSession(fakeAuth({}), TOKEN, "admin", NOW)).toEqual({ ok: false, reason: "forbidden" });
  });
  it("ignores a role sent anywhere but the custom claim", async () => {
    const r = await startSession(fakeAuth({ isAdmin: true, roles: ["admin"] }), TOKEN, "admin", NOW);
    expect(r).toEqual({ ok: false, reason: "forbidden" });
  });
  it("opens an admin session with the admin claim", async () => {
    const r = await startSession(fakeAuth({ role: "admin" }), TOKEN, "admin", NOW);
    expect(r).toMatchObject({ ok: true, user: { role: "admin" } });
  });
});

describe("resolveSession", () => {
  it("returns none without cookie", async () => {
    expect(await resolveSession(fakeAuth({}), undefined)).toEqual({ status: "none" });
  });
  it("returns the user for a valid cookie", async () => {
    expect(await resolveSession(fakeAuth({}), "c")).toMatchObject({ status: "ok", user: { uid: "u1" } });
  });
  it("detects an expired session", async () => {
    expect(await resolveSession(fakeAuth({}, { code: "auth/session-cookie-expired" }), "c")).toEqual({ status: "expired" });
  });
  it("treats a revoked or forged cookie as invalid", async () => {
    expect(await resolveSession(fakeAuth({}, { code: "auth/session-cookie-revoked" }), "c")).toEqual({ status: "invalid" });
    expect(await resolveSession(fakeAuth({}, { code: "auth/argument-error" }), "c")).toEqual({ status: "invalid" });
  });
});
