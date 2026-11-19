import "server-only";
import { createStripeCaller, createStripeClient, stripeKeyMode, type StripeClient, type StripeMode } from "./stripe-client";
import { createSubscriptionClient, type SubscriptionClient } from "./stripe-subscriptions";

/**
 * Server access to Stripe. The secret key (STRIPE_SECRET_KEY) and the webhook
 * secret (STRIPE_WEBHOOK_SECRET) are read at call time and never leave this
 * module (not logged, not sent to the browser). No publishable key is needed:
 * the customer pays on the Stripe-hosted Checkout page.
 */
/** `subscriptions`: Stripe Billing (Mail Club). Optional so the checkout test fakes need not provide it. */
export type StripeAccess = { client: StripeClient; mode: StripeMode; subscriptions?: SubscriptionClient };

export function stripeMode(): StripeMode | null {
  return stripeKeyMode(process.env.STRIPE_SECRET_KEY);
}

/** null when no valid key is configured. A live key is returned as such: the checkout gate decides. */
export function getStripe(): StripeAccess | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const mode = stripeKeyMode(key);
  if (!key || !mode) return null;
  return { client: createStripeClient(key), mode, subscriptions: createSubscriptionClient(createStripeCaller(key)) };
}

/** Webhook signing secret, null when missing or malformed. */
export function stripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret && /^whsec_[A-Za-z0-9]{16,}$/.test(secret) ? secret : null;
}
