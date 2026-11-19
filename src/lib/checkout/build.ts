import { commerceConfig, paymentConfig } from "@/config/commerce";
import { priceCart } from "@/lib/cart/pricing";
import type { PricedCart } from "@/lib/cart/types";
import type { OrderLineSnapshot, ShippingChoice, StockHold } from "@/lib/orders/types";
import type { StripeMode } from "@/lib/payments/stripe-client";
import { quoteShipping, type ParcelItem } from "@/lib/shipping/quote";
import type { ShippingQuote, ShippingSettings } from "@/lib/shipping/types";
import type { Product } from "@/lib/types";

/**
 * Pure checkout logic (no I/O): who may pay, and the order built from the
 * cart. Everything is recomputed from the catalogue and the shipping
 * settings; the browser only sends identifiers and quantities.
 */

export type GateReason = "checkout_closed" | "payment_not_configured" | "live_refused" | "demo_products";

/** Why checkout is closed, or null when payment may start. */
export function checkoutGate(input: {
  keyMode: StripeMode | null;
  hasDemo: boolean;
  checkoutEnabled?: boolean;
  allowLive?: boolean;
  allowDemoCheckoutInTestMode?: boolean;
}): GateReason | null {
  const enabled = input.checkoutEnabled ?? commerceConfig.checkoutEnabled;
  const allowLive = input.allowLive ?? paymentConfig.allowLive;
  const allowDemo = input.allowDemoCheckoutInTestMode ?? paymentConfig.allowDemoCheckoutInTestMode;
  if (!enabled) return "checkout_closed";
  if (!input.keyMode) return "payment_not_configured";
  if (input.keyMode === "live" && !allowLive) return "live_refused";
  // Demo products are never sold: only test payments, and only when allowed.
  if (input.hasDemo && !(allowDemo && input.keyMode === "test")) return "demo_products";
  return null;
}

export type CheckoutDraft = {
  cart: PricedCart;
  lines: OrderLineSnapshot[];
  holds: (StockHold & { initialStock: number })[];
  quote: ShippingQuote;
  shipping: ShippingChoice | null;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number | null;
  /** Lines changed by the server (quantity lowered, product gone): the customer must review the cart. */
  cartChanged: boolean;
};

/**
 * Prices the cart, quotes shipping for the country and builds the order
 * lines and stock holds. `rateId` picks the shipping option; without a
 * valid one the total stays null.
 */
export function buildCheckout(input: {
  items: unknown;
  products: Product[];
  settings: ShippingSettings;
  country: string;
  rateId?: string;
  now?: Date;
}): CheckoutDraft {
  const cart = priceCart(input.items, input.products, { now: input.now, checkoutEnabled: true });
  const byId = new Map(input.products.map((p) => [p.id, p]));
  const orderable = cart.lines.filter((l) => l.status === "ok" || l.status === "adjusted");
  const cartChanged = cart.hasBlockingIssue || cart.lines.some((l) => l.status === "adjusted");

  const lines: OrderLineSnapshot[] = [];
  const parcel: ParcelItem[] = [];
  const holdMap = new Map<string, StockHold & { initialStock: number }>();
  const addHold = (key: string, quantity: number, initialStock: number) => {
    const current = holdMap.get(key);
    holdMap.set(key, { key, quantity: (current?.quantity ?? 0) + quantity, initialStock });
  };

  for (const line of orderable) {
    const product = byId.get(line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant || line.unitPriceCents === null) continue;
    lines.push({
      productId: product.id,
      variantId: variant.id,
      sku: variant.sku,
      productName: product.name,
      variantName: variant.name,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: line.lineTotalCents,
      stockMode: variant.stockMode,
      ...(line.personalisation ? { personalisation: line.personalisation } : {}),
    });
    parcel.push({ quantity: line.quantity, weightGrams: variant.weightGrams, packedDimensionsMm: variant.packedDimensionsMm });
    if (variant.stockMode === "stocked") addHold(`${product.id}__${variant.id}`, line.quantity, Math.max(0, variant.stock ?? 0));
    const quota = product.personalisation?.quota;
    if (line.personalisation && typeof quota === "number") {
      addHold(`${product.id}__personalisation`, line.quantity, Math.max(0, quota - (product.personalisation?.quotaUsed ?? 0)));
    }
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const quote = quoteShipping({ country: input.country, subtotalCents, items: parcel }, input.settings);
  const option = quote.available ? quote.options.find((o) => o.rateId === input.rateId) : undefined;
  const shipping: ShippingChoice | null = option
    ? { rateId: option.rateId, label: option.label, zone: input.country, envelope: option.envelope, service: option.service, priceCents: option.priceCents }
    : null;
  const shippingCents = shipping?.priceCents ?? 0;

  return {
    cart,
    lines,
    holds: [...holdMap.values()],
    quote,
    shipping,
    subtotalCents,
    shippingCents,
    totalCents: shipping ? subtotalCents + shippingCents : null,
    cartChanged,
  };
}
