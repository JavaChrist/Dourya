import { commerceConfig } from "@/config/commerce";
import { availableStock } from "@/lib/catalog/visibility";
import type { PersonalisationConfig, Product, ProductVariant } from "@/lib/types";
import { PERSONALISATION_PATTERN, lineKey, sanitizeCartItems } from "./items";
import type { CartItem, PersonalisationSnapshot, PricedCart, PricedLine } from "./types";

export type PricingOptions = {
  now?: Date;
  checkoutEnabled?: boolean;
  defaultMaxQuantityPerLine?: number;
};

export function isPersonalisationOpen(
  config: PersonalisationConfig | undefined,
  variantId: string,
  now: Date,
): config is PersonalisationConfig {
  if (!config?.enabled) return false;
  if (config.variantIds?.length && !config.variantIds.includes(variantId)) return false;
  if (config.availableFrom && now < new Date(config.availableFrom)) return false;
  if (config.availableUntil && now > new Date(config.availableUntil)) return false;
  return true;
}

function remainingQuota(config: PersonalisationConfig): number {
  if (config.quota === null || config.quota === undefined) return Infinity;
  return Math.max(0, config.quota - (config.quotaUsed ?? 0));
}

/**
 * Prices a cart on the server from the catalogue only.
 *
 * - `input` is untrusted: any price, total or extra field sent by the browser is ignored.
 * - `products` must be the products currently listed for sale (published, visible category):
 *   anything else is reported as unavailable.
 * - Stock is shared between lines of the same variant (e.g. two personalisations).
 */
export function priceCart(input: unknown, products: Product[], options: PricingOptions = {}): PricedCart {
  const now = options.now ?? new Date();
  const defaultMax = options.defaultMaxQuantityPerLine ?? commerceConfig.maxQuantityPerLine;
  const checkoutEnabled = options.checkoutEnabled ?? commerceConfig.checkoutEnabled;

  const items = sanitizeCartItems(input);
  const byId = new Map(products.map((p) => [p.id, p]));
  const stockLeft = new Map<string, number>();
  const quotaLeft = new Map<string, number>();

  const lines = items.map((item) => priceLine(item));

  function base(item: CartItem, product?: Product, variant?: ProductVariant): PricedLine {
    return {
      key: lineKey(item),
      productId: item.productId,
      variantId: item.variantId,
      requestedQuantity: item.quantity,
      quantity: 0,
      maxQuantity: 0,
      status: "unavailable",
      productSlug: product?.slug,
      productName: product?.name,
      variantName: variant?.name,
      unitPriceCents: null,
      lineTotalCents: 0,
      isDemo: product?.isDemo ?? false,
      image: product?.images[0],
      demoVisual: product?.demoVisuals?.[0],
    };
  }

  function priceLine(item: CartItem): PricedLine {
    const product = byId.get(item.productId);
    if (!product || product.status !== "published") {
      return { ...base(item, product), message: "Ce produit n'est plus disponible." };
    }
    const variant = product.variants.find((v) => v.id === item.variantId);
    if (!variant || !variant.active) {
      return { ...base(item, product), message: "Cette option n'est plus proposée." };
    }
    const line = base(item, product, variant);
    if (variant.priceCents === null) {
      return { ...line, message: "Le prix de ce produit n'est pas encore défini." };
    }

    // Personalisation
    let personalisation: PersonalisationSnapshot | undefined;
    if (item.personalisation) {
      const config = product.personalisation;
      if (!isPersonalisationOpen(config, variant.id, now)) {
        return { ...line, status: "invalid", message: "La personnalisation n'est pas disponible pour ce produit." };
      }
      if (item.personalisation.length > config.maxLength) {
        return { ...line, status: "invalid", message: `Personnalisation limitée à ${config.maxLength} caractères.` };
      }
      if (!PERSONALISATION_PATTERN.test(item.personalisation)) {
        return { ...line, status: "invalid", message: "La personnalisation contient des caractères non autorisés." };
      }
      personalisation = { label: config.label, text: item.personalisation, surchargeCents: config.surchargeCents };
    }

    // Quantity: per-line cap, shared variant stock, personalisation quota
    const stockKey = `${product.id}|${variant.id}`;
    const stock = availableStock(variant);
    const left = stockLeft.get(stockKey) ?? stock ?? Infinity;
    let max = Math.min(product.maxQuantityPerLine ?? defaultMax, left);
    if (personalisation && product.personalisation) {
      const q = quotaLeft.get(product.id) ?? remainingQuota(product.personalisation);
      max = Math.min(max, q);
    }
    if (max <= 0) {
      const message = personalisation && left > 0 ? "Plus de personnalisation disponible pour le moment." : "Rupture de stock.";
      return { ...line, maxQuantity: 0, message };
    }

    const quantity = Math.min(item.quantity, max);
    if (stock !== null) stockLeft.set(stockKey, left - quantity);
    if (personalisation && product.personalisation) {
      quotaLeft.set(product.id, (quotaLeft.get(product.id) ?? remainingQuota(product.personalisation)) - quantity);
    }

    const unitPriceCents = variant.priceCents + (personalisation?.surchargeCents ?? 0);
    const adjusted = quantity < item.quantity;
    return {
      ...line,
      quantity,
      maxQuantity: max,
      status: adjusted ? "adjusted" : "ok",
      message: adjusted ? `Quantité ajustée à ${quantity} (maximum disponible).` : undefined,
      unitPriceCents,
      lineTotalCents: unitPriceCents * quantity,
      personalisation,
    };
  }

  const orderable = lines.filter((l) => l.status === "ok" || l.status === "adjusted");
  const hasDemo = lines.some((l) => l.isDemo);
  const hasBlockingIssue = lines.some((l) => l.status === "unavailable" || l.status === "invalid");
  return {
    lines,
    subtotalCents: orderable.reduce((sum, l) => sum + l.lineTotalCents, 0),
    itemCount: orderable.reduce((sum, l) => sum + l.quantity, 0),
    hasDemo,
    hasBlockingIssue,
    checkoutAllowed: checkoutEnabled && !hasDemo && !hasBlockingIssue && orderable.length > 0,
  };
}
