/**
 * Commerce settings. Nothing here is a business decision taken for DOURYA:
 * every value that depends on the merchant stays "not confirmed" until she
 * validates it.
 */

/**
 * VAT status of the merchant. null = not confirmed yet: prices are shown
 * without any "TTC" or "TVA non applicable" mention.
 *
 * Possible values once confirmed:
 * - { kind: "franchise" }                       VAT exemption (franchise en base)
 * - { kind: "vat", ratePercent: 20 }            VAT applies, prices include VAT
 */
export type TaxStatus = { kind: "franchise" } | { kind: "vat"; ratePercent: number };

export const taxConfig: { status: TaxStatus | null } = {
  status: null,
};

/** Mention shown next to prices, or null while the VAT status is not confirmed. */
export function priceMention(status: TaxStatus | null = taxConfig.status): string | null {
  if (!status) return null;
  if (status.kind === "franchise") return "TVA non applicable, art. 293 B du CGI";
  return "TTC";
}

export const commerceConfig = {
  currency: "EUR",
  /** Default cap for one cart line when the product sets none. */
  maxQuantityPerLine: 10,
  /** Max number of distinct lines accepted by the server. */
  maxCartLines: 50,
  /** Checkout opens in Lot 4.3 (Mollie). Demo products are never purchasable. */
  checkoutEnabled: false,
  /** Shipping is computed in Lot 4: no estimate is shown before that. */
  shippingEstimateEnabled: false,
  /**
   * Guest checkout (no account needed to order). On by default: making an account
   * mandatory needs the merchant's validation. Used from Lot 4.
   */
  guestCheckoutEnabled: true,
  /**
   * How long stock is held while a Mollie payment is awaited. Technical value
   * to be confirmed by the merchant; the hold is released when the payment
   * fails, expires or is cancelled.
   */
  stockReservationMinutes: 30,
} as const;

/**
 * Mollie payment methods offered at checkout. Card only by default: Apple Pay
 * and Google Pay stay off until they are activated on the Mollie account.
 * Amounts are always in EUR cents, recomputed on the server.
 */
export const paymentConfig = {
  provider: "mollie",
  methods: { creditcard: true, applepay: false, googlepay: false },
} as const;

export const accountConfig = {
  maxAddresses: 5,
  /** Countries offered for addresses. To adjust in Lot 4 with the real shipping zones (not confirmed yet). */
  addressCountries: [{ code: "FR", name: "France" }],
} as const;
