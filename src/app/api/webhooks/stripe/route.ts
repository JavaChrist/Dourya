import { NextResponse, type NextRequest } from "next/server";
import { handleStripeWebhook } from "@/lib/checkout/service";
import { getStripe, stripeWebhookSecret } from "@/lib/payments/stripe";
import { allowAction } from "@/lib/security/limit";

/** Checkout Session events stay well under this; anything bigger is refused unread. */
const MAX_BODY = 256 * 1024;

const reply = (status: number) => new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Stripe webhook. The Stripe-Signature header is verified on the exact raw
 * body with STRIPE_WEBHOOK_SECRET; then the Checkout Session is re-read at
 * Stripe with the secret key before being applied to its order. A repeated
 * or late event changes nothing that was already applied.
 */
export async function POST(request: NextRequest) {
  if (!(await allowAction("webhook:stripe"))) return reply(429);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return reply(413);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return reply(413);
  return reply(await handleStripeWebhook(raw, request.headers.get("stripe-signature"), getStripe(), stripeWebhookSecret()));
}
