import { createHmac, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ addSuppression: vi.fn(), recordProviderEvent: vi.fn() }));
vi.mock("@/lib/email/store", () => store);
vi.mock("@/lib/log", () => ({ logEvent: vi.fn(), errorCode: () => "test" }));

import { emailHash } from "@/lib/email/unsubscribe";
import { POST } from "./route";

// Fictitious values generated for the test, never a real key.
const KEY = randomBytes(24);
const SECRET = `whsec_${KEY.toString("base64")}`;
const ADDRESS = "client@example.test";

/** Signs a payload the Standard Webhooks way, as Resend (Svix) does. */
function signed(event: unknown, opts: { secretKey?: Buffer; timestamp?: number; headers?: boolean } = {}) {
  const payload = JSON.stringify(event);
  const id = `msg_${randomBytes(6).toString("hex")}`;
  const timestamp = String(opts.timestamp ?? Math.floor(Date.now() / 1000));
  const mac = createHmac("sha256", opts.secretKey ?? KEY).update(`${id}.${timestamp}.${payload}`).digest("base64");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.headers !== false) Object.assign(headers, { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${mac}` });
  return new NextRequest("https://dourya.fr/api/webhooks/resend", { method: "POST", body: payload, headers });
}

const emailEvent = (type: string, extra: Record<string, unknown> = {}) => ({
  type,
  created_at: new Date().toISOString(),
  data: { email_id: "re_test_1", from: "DOURYA <notifications@mail.example.test>", to: [ADDRESS], subject: "Test", created_at: new Date().toISOString(), ...extra },
});

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", SECRET);
    vi.stubEnv("RESEND_API_KEY", "re_test_fictif");
    store.addSuppression.mockReset().mockResolvedValue(undefined);
    store.recordProviderEvent.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("suppresses the address (hash only) on a permanent bounce", async () => {
    const res = await POST(signed(emailEvent("email.bounced", { bounce: { type: "Permanent", subType: "General", message: "x" } })));
    expect(res.status).toBe(200);
    expect(store.recordProviderEvent).toHaveBeenCalledWith("re_test_1", "email.bounced");
    expect(store.addSuppression).toHaveBeenCalledWith(emailHash(ADDRESS), "bounce");
  });

  it("only records a transient bounce", async () => {
    const res = await POST(signed(emailEvent("email.bounced", { bounce: { type: "Transient", subType: "MailboxFull", message: "x" } })));
    expect(res.status).toBe(200);
    expect(store.recordProviderEvent).toHaveBeenCalledOnce();
    expect(store.addSuppression).not.toHaveBeenCalled();
  });

  it("maps a complaint and a provider suppression", async () => {
    expect((await POST(signed(emailEvent("email.complained")))).status).toBe(200);
    expect(store.addSuppression).toHaveBeenLastCalledWith(emailHash(ADDRESS), "complaint");
    expect((await POST(signed(emailEvent("email.suppressed")))).status).toBe(200);
    expect(store.addSuppression).toHaveBeenLastCalledWith(emailHash(ADDRESS), "provider");
  });

  it("records delivery events without suppressing", async () => {
    for (const type of ["email.sent", "email.delivered", "email.delivery_delayed", "email.failed"]) {
      expect((await POST(signed(emailEvent(type)))).status).toBe(200);
      expect(store.recordProviderEvent).toHaveBeenLastCalledWith("re_test_1", type);
    }
    expect(store.addSuppression).not.toHaveBeenCalled();
  });

  it("refuses a wrong signature, an old timestamp or missing headers", async () => {
    expect((await POST(signed(emailEvent("email.complained"), { secretKey: randomBytes(24) }))).status).toBe(400);
    expect((await POST(signed(emailEvent("email.complained"), { timestamp: Math.floor(Date.now() / 1000) - 3600 }))).status).toBe(400);
    expect((await POST(signed(emailEvent("email.complained"), { headers: false }))).status).toBe(400);
    expect(store.recordProviderEvent).not.toHaveBeenCalled();
    expect(store.addSuppression).not.toHaveBeenCalled();
  });

  it("answers 503 without a secret and 500 on a storage error (Resend retries)", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    expect((await POST(signed(emailEvent("email.delivered")))).status).toBe(503);
    vi.stubEnv("RESEND_WEBHOOK_SECRET", SECRET);
    store.recordProviderEvent.mockRejectedValueOnce(new Error("firestore down"));
    expect((await POST(signed(emailEvent("email.delivered")))).status).toBe(500);
  });
});
