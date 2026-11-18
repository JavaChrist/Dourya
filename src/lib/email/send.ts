import "server-only";
import { randomUUID } from "node:crypto";
import { siteOrigin } from "@/config/site";
import { errorCode, logEvent } from "@/lib/log";
import { canSend, readEmailConfig, type EmailConfig } from "./config";
import { renderEmail, EMAIL_TEMPLATES, type EmailCategory, type EmailData, type EmailType } from "./registry";
import { isSuppressed, loadTemplateOverride, writeEmailLog } from "./store";
import { MemoryTransport, ResendTransport, type EmailTransport } from "./transport";
import { createUnsubscribeToken, emailHash, listUnsubscribeHeaders } from "./unsubscribe";

export type SendOutcome =
  | { status: "sent"; id: string }
  /** EMAIL_TRANSPORT is "firebase": the custom e-mails are off, the caller keeps the Firebase e-mails. */
  | { status: "disabled" }
  /** Marketing only: unsubscribed, bounced or complained address. */
  | { status: "suppressed" }
  | { status: "failed"; error: "config" | "render" | "rate_limited" | "rejected" | "unavailable" };

type Globals = typeof globalThis & { __douryaTestOutbox?: MemoryTransport; __douryaResend?: { key: string; transport: ResendTransport } };
const g = globalThis as Globals;

/** In-memory outbox of the test transport (kept across hot reloads in dev). */
export function testOutbox(): MemoryTransport {
  g.__douryaTestOutbox ??= new MemoryTransport();
  return g.__douryaTestOutbox;
}

function transportFor(config: EmailConfig): EmailTransport {
  if (config.mode === "test") return testOutbox();
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  if (g.__douryaResend?.key !== key) g.__douryaResend = { key, transport: new ResendTransport(key) };
  return g.__douryaResend.transport;
}

export function isCustomEmailEnabled(): boolean {
  return readEmailConfig().mode !== "firebase";
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Renders and sends one DOURYA e-mail, server side only.
 * Security and transactional e-mails are never blocked by a marketing unsubscribe.
 * Logs carry the type, the status and a hash of the address: never the address,
 * the link or the code.
 */
export async function sendEmail<T extends EmailType>(type: T, to: string, data: EmailData<T>, options: { uid?: string } = {}): Promise<SendOutcome> {
  const config = readEmailConfig();
  if (config.mode === "firebase") return { status: "disabled" };
  if (!canSend(config)) {
    logEvent("email_config_missing", { type, missing: config.missing.join(",") });
    return { status: "failed", error: "config" };
  }

  const category = EMAIL_TEMPLATES[type].category as EmailCategory;
  const toHash = emailHash(to);
  const origin = siteOrigin();
  const transport = transportFor(config);
  let headers: Record<string, string> | undefined;
  let unsubscribeUrl: string | undefined;

  if (category === "marketing") {
    const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "";
    if (secret.length < 32) {
      logEvent("email_config_missing", { type, missing: "EMAIL_UNSUBSCRIBE_SECRET" });
      return { status: "failed", error: "config" };
    }
    if (await isSuppressed(toHash)) {
      await writeEmailLog({ type, category, transport: transport.name, status: "suppressed", toHash, uid: options.uid }).catch(() => undefined);
      return { status: "suppressed" };
    }
    const token = createUnsubscribeToken({ list: "newsletter", emailHash: toHash, uid: options.uid }, secret);
    unsubscribeUrl = `${origin}/desinscription?token=${encodeURIComponent(token)}`;
    headers = listUnsubscribeHeaders(`${origin}/api/email/desinscription?token=${encodeURIComponent(token)}`);
  }

  let rendered;
  try {
    rendered = await renderEmail(type, data, { origin, legal: config.legal, unsubscribeUrl }, await loadTemplateOverride(type));
  } catch (error) {
    logEvent("email_render_failed", { type, error: errorCode(error) });
    return { status: "failed", error: "render" };
  }

  const email = {
    from: config.from || "DOURYA <test@localhost.test>",
    to,
    replyTo: config.replyTo || undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers,
    tags: [{ name: "type", value: type }, { name: "category", value: category }],
    // Same key on the retry below: Resend never sends the same e-mail twice.
    idempotencyKey: `${type}/${randomUUID()}`,
  };

  let result = await transport.send(email);
  if (!result.ok && result.retryable) {
    await wait(800);
    result = await transport.send(email);
  }

  await writeEmailLog({
    type,
    category,
    transport: transport.name,
    status: result.ok ? "sent" : "failed",
    toHash,
    uid: options.uid,
    providerId: result.ok ? result.id : undefined,
    error: result.ok ? undefined : result.error,
  }).catch((error) => logEvent("email_log_failed", { type, error: errorCode(error) }));

  logEvent(result.ok ? "email_sent" : "email_failed", { type, transport: transport.name, ...(result.ok ? {} : { error: result.error }) });
  return result.ok ? { status: "sent", id: result.id } : { status: "failed", error: result.error };
}

