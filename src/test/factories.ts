import type { Product, ProductVariant } from "@/lib/types";

export function variant(over: Partial<ProductVariant> = {}): ProductVariant {
  return { id: "v1", sku: "SKU-1", name: "Unique", attributes: [], priceCents: 1000, stockMode: "made_to_order", active: true, ...over };
}

/** A real (non-demo) published product, so checkout rules can be tested. */
export function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "produit-1",
    name: "Produit 1",
    description: "Description",
    status: "published",
    categorySlugs: ["prints"],
    collectionSlugs: [],
    images: [],
    variants: [variant()],
    isDemo: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}
