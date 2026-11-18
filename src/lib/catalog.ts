import { categories } from "@/data/categories";
import { products } from "@/data/products";
import type { Category, Product } from "@/lib/types";

/**
 * Read access to the catalogue. Components only call these functions, so the
 * static data can later be swapped for Firestore without touching the UI.
 */

export function getVisibleCategories(): Category[] {
  return categories.filter((c) => c.visible).sort((a, b) => a.order - b.order);
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug && c.visible);
}

export function getProducts(): Product[] {
  const visible = new Set(getVisibleCategories().map((c) => c.slug));
  return products.filter((p) => visible.has(p.categorySlug));
}

export function getProductsByCategory(slug: string): Product[] {
  return getProducts().filter((p) => p.categorySlug === slug);
}

export function getProduct(slug: string): Product | undefined {
  return getProducts().find((p) => p.slug === slug);
}

/** Formats a price, or says it is not set yet (prices are never invented). */
export function formatPrice(cents: number | null): string {
  if (cents === null) return "Prix à venir";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}
