import { commerceConfig } from "@/config/commerce";
import type { StripeMode } from "@/lib/payments/stripe-client";

/**
 * Test preview of the checkout. The public site keeps checkout closed
 * (commerceConfig.checkoutEnabled = false); only the Vercel preview of the
 * `stripe-test` branch may open it, and only when every condition holds:
 * - VERCEL_ENV is "preview" and the branch is exactly `stripe-test`;
 * - CHECKOUT_ENABLED is "true";
 * - FIRESTORE_DATABASE_ID is exactly `dourya-test` (orders, stock holds and
 *   webhooks then go to the test database, never to the public one);
 * - the Stripe key is a test key.
 * Any missing condition keeps the checkout closed. Pure (env passed in) so it
 * can be unit-tested.
 */
export const TEST_PREVIEW_BRANCH = "stripe-test";
export const TEST_DATABASE_ID = "dourya-test";

/** process.env or a test object. Read: VERCEL_ENV, VERCEL_GIT_COMMIT_REF, CHECKOUT_ENABLED, FIRESTORE_DATABASE_ID. */
type Env = { readonly [key: string]: string | undefined };

/**
 * Firestore database used by the server. Production always uses "(default)";
 * elsewhere only the test database name is accepted, anything else falls back
 * to "(default)" (returned as undefined).
 */
export function firestoreDatabaseId(env: Env): string | undefined {
  if (env.VERCEL_ENV === "production") return undefined;
  return env.FIRESTORE_DATABASE_ID?.trim() === TEST_DATABASE_ID ? TEST_DATABASE_ID : undefined;
}

export function isTestPreviewCheckout(env: Env, keyMode: StripeMode | null): boolean {
  return (
    env.VERCEL_ENV === "preview" &&
    env.VERCEL_GIT_COMMIT_REF === TEST_PREVIEW_BRANCH &&
    env.CHECKOUT_ENABLED?.trim() === "true" &&
    firestoreDatabaseId(env) === TEST_DATABASE_ID &&
    keyMode === "test"
  );
}

export type CheckoutSwitch = { checkoutEnabled: boolean; allowDemoCheckoutInTestMode: boolean };

/**
 * Who may create a Stripe Checkout Session:
 * - the test preview (above): open, demo products allowed, test key only;
 * - real sales: only the production deployment (VERCEL_ENV = "production")
 *   with a live key AND commerceConfig.checkoutEnabled. Any other preview,
 *   local run or test key outside the test preview stays closed, even once
 *   checkoutEnabled is true (previews would otherwise sell on "(default)").
 * Demo products are never allowed outside the test preview.
 * This only gates new sessions: the webhook keeps applying payments already
 * started and refunds whatever this switch says.
 */
export function checkoutSwitch(env: Env, keyMode: StripeMode | null): CheckoutSwitch {
  if (isTestPreviewCheckout(env, keyMode)) return { checkoutEnabled: true, allowDemoCheckoutInTestMode: true };
  const realSales = env.VERCEL_ENV === "production" && keyMode === "live";
  return { checkoutEnabled: realSales && commerceConfig.checkoutEnabled, allowDemoCheckoutInTestMode: false };
}
