import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Each test uses its own client IP so the per-IP limits do not leak between tests.
let ip = "203.0.113.1";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": ip }) }));

import { adminDb } from "@/lib/firebase/admin-db";
import { deliverPasswordReset, deliverVerificationEmail } from "@/lib/email/auth-emails";
import { testOutbox } from "@/lib/email/send";
import { addSuppression, isSuppressed, liftUnsubscribe } from "@/lib/email/store";
import { unsubscribe } from "@/lib/email/unsubscribe-service";
import { createUnsubscribeToken, emailHash } from "@/lib/email/unsubscribe";
import { applyEmailVerification, clearAuth, resetPassword, signIn, signUp } from "../helpers/auth-emulator";

/**
 * DOURYA account e-mails on the emulators, with the in-memory test transport
 * (EMAIL_TRANSPORT=test, set by scripts/emulators.mjs): nothing is ever sent.
 */
const PASSWORD = "une phrase de passe solide";
const SECRET = "secret-de-test-fictif-0123456789abcdef";
let n = 0;
const uniqueEmail = (name: string) => `${name}-${Date.now()}-${++n}@example.test`;

function codeFrom(text: string, mode: string): string {
  const line = text.split("\n").find((l) => l.startsWith("http") && l.includes("/auth/action")) ?? "";
  const url = new URL(line || "http://invalid");
  const code = url.searchParams.get("oobCode");
  if (url.pathname !== "/auth/action" || url.searchParams.get("mode") !== mode || !code) throw new Error("no action link in the e-mail");
  return code;
}

beforeAll(async () => {
  expect(process.env.EMAIL_TRANSPORT).toBe("test");
  process.env.EMAIL_UNSUBSCRIBE_SECRET = SECRET;
  await clearAuth();
  // Other suites may leave admin overrides behind: these tests check the default texts.
  const templates = await adminDb().collection("emailTemplates").get();
  await Promise.all(templates.docs.map((d) => d.ref.delete()));
});

beforeEach(() => {
  ip = `203.0.113.${++n % 250}`;
  testOutbox().clear();
});

describe("verification e-mail", () => {
  it("sends a DOURYA e-mail whose link verifies the account, and logs no link or address", async () => {
    const email = uniqueEmail("bienvenue");
    const { localId } = await signUp(email, PASSWORD);
    expect(await deliverVerificationEmail({ uid: localId, email })).toBe("sent");

    const [mail] = testOutbox().sent;
    expect(mail.to).toBe(email);
    expect(mail.subject).toBe("Confirmez votre adresse e-mail DOURYA");
    expect(mail.headers?.["List-Unsubscribe"]).toBeUndefined();
    const code = codeFrom(mail.text, "verifyEmail");
    await applyEmailVerification(code);

    const logs = await adminDb().collection("emailLog").where("uid", "==", localId).get();
    expect(logs.size).toBe(1);
    const stored = JSON.stringify(logs.docs[0].data());
    expect(stored).not.toContain(email);
    expect(stored).not.toContain(code);
    expect(logs.docs[0].get("toHash")).toBe(emailHash(email));
  });

  it("is limited to 3 per hour for one account", async () => {
    const email = uniqueEmail("limite");
    const { localId } = await signUp(email, PASSWORD);
    for (let i = 0; i < 3; i++) expect(await deliverVerificationEmail({ uid: localId, email })).toBe("sent");
    expect(await deliverVerificationEmail({ uid: localId, email })).toBe("rate_limited");
    expect(testOutbox().sent).toHaveLength(3);
  });

  it("is still sent to an address unsubscribed from marketing", async () => {
    const email = uniqueEmail("desinscrite");
    const { localId } = await signUp(email, PASSWORD);
    await addSuppression(emailHash(email), "complaint");
    expect(await deliverVerificationEmail({ uid: localId, email })).toBe("sent");
  });
});

describe("password reset e-mail", () => {
  it("sends a link that sets a new password", async () => {
    const email = uniqueEmail("oubli");
    await signUp(email, PASSWORD);
    expect(await deliverPasswordReset(email.toUpperCase())).toBe("done");
    const [mail] = testOutbox().sent;
    expect(mail.subject).toBe("Réinitialisez votre mot de passe DOURYA");
    await resetPassword(codeFrom(mail.text, "resetPassword"), "un tout nouveau mot de passe");
    await expect(signIn(email, "un tout nouveau mot de passe")).resolves.toMatchObject({ idToken: expect.any(String) });
  });

  it("answers the same for an unknown address, without sending anything", async () => {
    expect(await deliverPasswordReset(uniqueEmail("inconnue"))).toBe("done");
    expect(testOutbox().sent).toHaveLength(0);
  });
});

describe("marketing unsubscribe", () => {
  it("suppresses the address, withdraws the consent and is lifted by a new opt-in", async () => {
    const email = uniqueEmail("newsletter");
    const { localId } = await signUp(email, PASSWORD);
    await adminDb().doc(`users/${localId}`).set({ consents: { newsletter: { granted: true } } });
    const hash = emailHash(email);
    const token = createUnsubscribeToken({ list: "newsletter", emailHash: hash, uid: localId }, SECRET);

    expect(await unsubscribe(`${token}x`, "unsubscribe-link")).toBe("invalid");
    expect(await unsubscribe(token, "one-click")).toBe("done");
    expect(await isSuppressed(hash)).toBe(true);
    const consent = (await adminDb().doc(`users/${localId}`).get()).get("consents.newsletter");
    expect(consent).toMatchObject({ granted: false, source: "one-click" });

    await liftUnsubscribe(hash);
    expect(await isSuppressed(hash)).toBe(false);
  });

  it("never replaces a bounce, which a new opt-in does not lift", async () => {
    const hash = emailHash(uniqueEmail("rebond"));
    await addSuppression(hash, "bounce");
    await addSuppression(hash, "unsubscribe");
    await liftUnsubscribe(hash);
    expect((await adminDb().doc(`emailSuppressions/${hash}`).get()).get("reason")).toBe("bounce");
  });

  it("does not create a profile for an unknown account", async () => {
    const token = createUnsubscribeToken({ list: "newsletter", emailHash: emailHash("x@example.test"), uid: "compteInexistant" }, SECRET);
    expect(await unsubscribe(token, "unsubscribe-link")).toBe("done");
    expect((await adminDb().doc("users/compteInexistant").get()).exists).toBe(false);
  });
});
