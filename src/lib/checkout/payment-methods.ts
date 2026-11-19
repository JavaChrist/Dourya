import { paymentConfig } from "@/config/commerce";
import type { StripeMode } from "@/lib/payments/stripe-client";
import { isTestPreviewCheckout } from "./test-preview";

export type PaymentMethodId = "card" | "apple_pay" | "google_pay";

/** One method shown in the checkout summary. logo = official mark under public/, or null (name shown as text). */
export type PaymentMethodBadge = { id: PaymentMethodId; label: string; logo: string | null };

type Display = { readonly applePay: { shown: boolean; logo: string | null }; readonly googlePay: { shown: boolean; logo: string | null } };

/**
 * Methods shown under the checkout button (display only, Stripe offers what
 * its dashboard enables). Card always; Apple Pay and Google Pay once
 * validated (paymentConfig.display), or on the stripe-test preview to check
 * the layout before that.
 */
export function paymentMethods(env: { readonly [key: string]: string | undefined }, keyMode: StripeMode | null, display: Display = paymentConfig.display): PaymentMethodBadge[] {
  const preview = isTestPreviewCheckout(env, keyMode);
  const methods: PaymentMethodBadge[] = [{ id: "card", label: "Carte bancaire", logo: null }];
  if (preview || display.applePay.shown) methods.push({ id: "apple_pay", label: "Apple Pay", logo: display.applePay.logo });
  if (preview || display.googlePay.shown) methods.push({ id: "google_pay", label: "Google Pay", logo: display.googlePay.logo });
  return methods;
}
