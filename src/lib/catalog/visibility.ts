import type { Category, Collection, Product, ProductVariant } from "@/lib/types";

/** Publication rules, independent from the storage. */

export function visibleCategories(categories: Category[]): Category[] {
  return categories.filter((c) => c.visible).sort((a, b) => a.order - b.order);
}

export function visibleCollections(collections: Collection[]): Collection[] {
  return collections.filter((c) => c.visible).sort((a, b) => a.order - b.order);
}

/**
 * A product is listed when it is published and belongs to at least one
 * visible category (so products of a hidden category, e.g. Headbands, stay hidden).
 */
export function isListed(product: Product, visibleCategorySlugs: Set<string>): boolean {
  return product.status === "published" && product.categorySlugs.some((s) => visibleCategorySlugs.has(s));
}

/** Listed, or a draft when the draft preview is on (whatever its category: e.g. Headbands, Mail Club). */
export function isShown(product: Product, visibleCategorySlugs: Set<string>, draftPreview: boolean): boolean {
  return isListed(product, visibleCategorySlugs) || (draftPreview && product.status === "draft");
}

/** Units a customer can take for this variant right now (null = no stock limit). */
export function availableStock(variant: ProductVariant): number | null {
  if (variant.stockMode === "made_to_order") return null;
  return Math.max(0, variant.stock ?? 0);
}

/** Stocked variant with no stock count entered yet (counts as 0, so it cannot be sold). */
export function stockToValidate(variant: ProductVariant): boolean {
  return variant.stockMode === "stocked" && (variant.stock === null || variant.stock === undefined);
}

/** A variant can be added to the cart: active, priced and not out of stock. */
export function isVariantPurchasable(variant: ProductVariant): boolean {
  if (!variant.active || variant.priceCents === null) return false;
  const stock = availableStock(variant);
  return stock === null || stock > 0;
}

export type Availability =
  | { kind: "made_to_order" }
  | { kind: "in_stock"; stock: number; low: boolean }
  | { kind: "out_of_stock" }
  | { kind: "no_price" }
  | { kind: "inactive" };

export function variantAvailability(variant: ProductVariant): Availability {
  if (!variant.active) return { kind: "inactive" };
  if (variant.priceCents === null) return { kind: "no_price" };
  const stock = availableStock(variant);
  if (stock === null) return { kind: "made_to_order" };
  if (stock === 0) return { kind: "out_of_stock" };
  return { kind: "in_stock", stock, low: stock <= (variant.lowStockThreshold ?? 0) };
}

/** Lowest displayed price among active priced variants, or null. */
export function minPrice(product: Product): number | null {
  const prices = product.variants.filter((v) => v.active && v.priceCents !== null).map((v) => v.priceCents as number);
  return prices.length ? Math.min(...prices) : null;
}

/** Product-level state shown on the product page. */
export type ProductPageState = "available" | "unavailable" | "archived";

export function productPageState(product: Product): ProductPageState {
  if (product.status === "archived") return "archived";
  return product.variants.some(isVariantPurchasable) ? "available" : "unavailable";
}
