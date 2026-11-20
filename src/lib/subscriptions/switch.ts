import { mailClubConfig } from "@/config/commerce";
import { isTestPreviewCheckout, type CheckoutSwitch } from "@/lib/checkout/test-preview";
import type { StripeMode } from "@/lib/payments/stripe-client";
import { isUid } from "@/lib/payments/stripe-subscriptions";

/** process.env or a test object. Read: VERCEL_ENV, MAIL_CLUB_TEST_MODE, MAIL_CLUB_TEST_UID (+ the test preview ones). */
type Env = { readonly [key: string]: string | undefined };

/** `test`: the sale is open only for the authorised test account (Stripe test key, no real payment). */
export type MailClubSwitch = CheckoutSwitch & { test: boolean };

const CLOSED: MailClubSwitch = { checkoutEnabled: false, allowDemoCheckoutInTestMode: false, test: false };
const TEST_OPEN: MailClubSwitch = { checkoutEnabled: true, allowDemoCheckoutInTestMode: false, test: true };

/**
 * Test of the Mail Club on dourya.fr, for one account only. Open when every
 * condition holds:
 * - VERCEL_ENV is "production";
 * - MAIL_CLUB_TEST_MODE is exactly "true";
 * - the Stripe key is a TEST key (a live key never opens this path);
 * - the signed-in user's uid is exactly MAIL_CLUB_TEST_UID.
 */
export function isMailClubTestAccount(env: Env, keyMode: StripeMode | null, uid: string | null): boolean {
  const testUid = env.MAIL_CLUB_TEST_UID?.trim();
  return (
    env.VERCEL_ENV === "production" &&
    env.MAIL_CLUB_TEST_MODE?.trim() === "true" &&
    keyMode === "test" &&
    isUid(testUid) &&
    uid === testUid
  );
}

/**
 * Who may start a Mail Club subscription (checked on the server before the
 * Stripe session is created):
 * - the authorised test account on dourya.fr (above), test key only;
 * - the stripe-test preview (test database, test key);
 * - real subscriptions: production, live key AND mailClubConfig.liveEnabled
 *   (false: the go-live is a separate decision). Independent of the shop
 *   checkout, which stays closed.
 * Everyone else sees « L'abonnement en ligne ouvrira prochainement ».
 */
export function mailClubSwitch(env: Env, keyMode: StripeMode | null, uid: string | null): MailClubSwitch {
  if (isMailClubTestAccount(env, keyMode, uid)) return TEST_OPEN;
  if (isTestPreviewCheckout(env, keyMode)) return TEST_OPEN;
  const live = env.VERCEL_ENV === "production" && keyMode === "live" && mailClubConfig.liveEnabled;
  return live ? { checkoutEnabled: true, allowDemoCheckoutInTestMode: false, test: false } : CLOSED;
}
