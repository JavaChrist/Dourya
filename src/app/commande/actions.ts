"use server";

import { siteOrigin } from "@/config/site";
import { getSessionUser } from "@/lib/auth/dal";
import { getListedProducts } from "@/lib/catalog";
import { buildCheckout, checkoutGate, type GateReason } from "@/lib/checkout/build";
import { placeOrder, type PlaceOrderErrorCode } from "@/lib/checkout/service";
import { paymentMethods, type PaymentMethodBadge } from "@/lib/checkout/payment-methods";
import { checkoutSwitch } from "@/lib/checkout/test-preview";
import type { FieldErrors } from "@/lib/account/validation";
import type { PricedLine } from "@/lib/cart/types";
import { getShippingSettings } from "@/lib/orders/repository";
import { getStripe, stripeMode } from "@/lib/payments/stripe";
import { isStripeCheckoutUrl } from "@/lib/payments/stripe-client";
import { allowAction } from "@/lib/security/limit";
import type { ShippingOption } from "@/lib/shipping/types";

export type CheckoutSummary = {
  lines: Pick<PricedLine, "key" | "productName" | "variantName" | "quantity" | "unitPriceCents" | "lineTotalCents" | "personalisation" | "isDemo" | "status" | "message">[];
  subtotalCents: number;
  options: ShippingOption[];
  /** null when shipping can be quoted. */
  shippingProblem: string | null;
  cartChanged: boolean;
  /** null when payment may start; otherwise why the button stays disabled. */
  closedReason: string | null;
  /** Methods shown under the button (display only). */
  paymentMethods: PaymentMethodBadge[];
};

const GATE_MESSAGES: Record<GateReason, string> = {
  checkout_closed: "Le paiement en ligne ouvrira prochainement.",
  payment_not_configured: "Le paiement en ligne n'est pas encore disponible.",
  live_refused: "Le paiement en ligne n'est pas encore disponible.",
  demo_products: "Votre panier contient des produits de démonstration, qui ne sont pas en vente.",
};

const SHIPPING_MESSAGES: Record<string, string> = {
  zone_unknown: "La livraison n'est pas proposée vers ce pays.",
  zone_disabled: "La livraison n'est pas encore ouverte vers ce pays.",
  missing_parcel_data: "La livraison ne peut pas encore être calculée pour un article de votre panier.",
  no_matching_rate: "Aucun mode de livraison ne convient à ce panier pour le moment.",
  empty_cart: "Votre panier est vide.",
};

/** Summary and shipping options for the checkout form. Read-only, recomputed on the server. */
export async function checkoutSummaryAction(items: unknown, country: unknown): Promise<CheckoutSummary> {
  const [products, settings] = await Promise.all([getListedProducts(), getShippingSettings()]);
  const draft = buildCheckout({ items, products, settings, country: typeof country === "string" ? country.toUpperCase() : "FR" });
  const keyMode = stripeMode();
  const gate = checkoutGate({ keyMode, hasDemo: draft.cart.hasDemo, ...checkoutSwitch(process.env, keyMode) });
  return {
    lines: draft.cart.lines.map(({ key, productName, variantName, quantity, unitPriceCents, lineTotalCents, personalisation, isDemo, status, message }) => ({
      key, productName, variantName, quantity, unitPriceCents, lineTotalCents, personalisation, isDemo, status, message,
    })),
    subtotalCents: draft.subtotalCents,
    options: draft.quote.available ? draft.quote.options : [],
    shippingProblem: draft.quote.available ? null : SHIPPING_MESSAGES[draft.quote.reason],
    cartChanged: draft.cartChanged,
    closedReason: gate ? GATE_MESSAGES[gate] : null,
    paymentMethods: paymentMethods(process.env, keyMode),
  };
}

const ERROR_MESSAGES: Record<PlaceOrderErrorCode | "rate_limited", string> = {
  ...GATE_MESSAGES,
  login_required: "Connectez-vous pour passer commande.",
  invalid_form: "Vérifiez les champs signalés.",
  cart_empty: "Votre panier est vide.",
  cart_changed: "Votre panier a changé (stock ou prix). Vérifiez-le avant de payer.",
  total_changed: "Le total a changé depuis l'affichage. Vérifiez le récapitulatif mis à jour.",
  shipping_unavailable: "Ce mode de livraison n'est plus disponible. Choisissez-en un autre.",
  out_of_stock: "Un article vient d'être réservé par un autre client. Vérifiez votre panier.",
  attempt_conflict: "Votre commande a changé. Vérifiez le récapitulatif puis validez à nouveau.",
  order_closed: "Cette tentative de paiement a expiré. Validez à nouveau.",
  payment_error: "Le paiement n'a pas pu être préparé. Réessayez dans un instant.",
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
};

export type PlaceOrderActionResult =
  | { ok: true; url: string }
  | { ok: false; message: string; fieldErrors?: FieldErrors; resetAttempt?: boolean; refresh?: boolean };

export async function placeOrderAction(input: {
  attemptKey: string;
  items: unknown;
  email: unknown;
  address: Record<string, unknown>;
  rateId: unknown;
  acceptTerms: unknown;
  expectedTotalCents: unknown;
}): Promise<PlaceOrderActionResult> {
  const user = await getSessionUser();
  if (!(await allowAction("checkout:place", user?.uid))) return { ok: false, message: ERROR_MESSAGES.rate_limited };
  const [products, settings] = await Promise.all([getListedProducts(), getShippingSettings()]);
  const origin = siteOrigin();
  const result = await placeOrder(
    {
      attemptKey: typeof input?.attemptKey === "string" ? input.attemptKey : "",
      items: input?.items,
      email: input?.email,
      address: input?.address && typeof input.address === "object" ? input.address : {},
      rateId: input?.rateId,
      acceptTerms: input?.acceptTerms,
      expectedTotalCents: input?.expectedTotalCents,
    },
    { stripe: getStripe(), products, settings, customer: user ? { uid: user.uid } : null, origin, checkout: checkoutSwitch(process.env, stripeMode()) },
  );
  if (result.kind === "redirect") {
    // Only Stripe's hosted page or our own return page.
    const safe = result.url.startsWith(`${origin}/commande/retour?`) || isStripeCheckoutUrl(result.url);
    return safe ? { ok: true, url: result.url } : { ok: false, message: ERROR_MESSAGES.payment_error };
  }
  return {
    ok: false,
    message: ERROR_MESSAGES[result.code],
    fieldErrors: result.fieldErrors,
    resetAttempt: result.resetAttempt,
    refresh: ["cart_changed", "total_changed", "shipping_unavailable", "out_of_stock", "attempt_conflict"].includes(result.code),
  };
}
