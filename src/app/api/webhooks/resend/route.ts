import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { addSuppression, recordProviderEvent, type SuppressionReason } from "@/lib/email/store";
import { emailHash } from "@/lib/email/unsubscribe";
import { errorCode, logEvent } from "@/lib/log";

const MAX_BODY = 256 * 1024;

const reply = (status: number) => new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Resend events, signed with RESEND_WEBHOOK_SECRET (Standard Webhooks / Svix headers).
 * A hard bounce or a complaint suppresses the address for marketing only:
 * security and transactional e-mails are never blocked here.
 * Logs carry the event type, never the address.
 */
export async function POST(request: NextRequest) {
  const secret = (process.env.RESEND_WEBHOOK_SECRET ?? "").trim();
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  if (!secret || !apiKey) {
    logEvent("email_config_missing", { type: "webhook", missing: [!secret && "RESEND_WEBHOOK_SECRET", !apiKey && "RESEND_API_KEY"].filter(Boolean).join(",") });
    return reply(503);
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return reply(413);
  const payload = await request.text();
  if (payload.length > MAX_BODY) return reply(413);

  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return reply(400);

  let event;
  try {
    event = new Resend(apiKey).webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret: secret });
  } catch {
    logEvent("email_webhook_refused", { reason: "signature" });
    return reply(400);
  }

  try {
    let reason: SuppressionReason | null = null;
    let addresses: string[] = [];
    if (event.type === "email.bounced" && event.data.bounce?.type === "Permanent") reason = "bounce";
    else if (event.type === "email.complained") reason = "complaint";
    else if (event.type === "email.suppressed") reason = "provider";
    if (event.type.startsWith("email.") && "email_id" in event.data) {
      const data = event.data as { email_id: string; to?: string[] };
      addresses = Array.isArray(data.to) ? data.to : [];
      await recordProviderEvent(data.email_id, event.type);
    } else if (event.type === "suppression.added") {
      reason = event.data.origin === "complaint" ? "complaint" : event.data.origin === "bounce" ? "bounce" : "provider";
      addresses = [event.data.email];
    }
    if (reason) for (const address of addresses.slice(0, 50)) await addSuppression(emailHash(address), reason);
    logEvent("email_webhook", { event: event.type, ...(reason ? { suppression: reason } : {}) });
  } catch (error) {
    logEvent("email_webhook_failed", { event: event.type, error: errorCode(error) });
    return reply(500); // Resend retries the delivery.
  }
  return reply(200);
}
