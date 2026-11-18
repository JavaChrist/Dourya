import { categories } from "@/data/categories";
import { collections } from "@/data/collections";
import { products } from "@/data/products";
import type { Category, Collection, Product } from "@/lib/types";
import { createFixtureRepository } from "./fixture-repository";
import type { CatalogRepository } from "./repository";
import { isListed, visibleCategories, visibleCollections } from "./visibility";

/**
 * Public catalogue API used by pages and server actions.
 * To switch to Firestore, replace `repository` with a Firestore implementation
 * of CatalogRepository: nothing else changes.
 */
export const repository: CatalogRepository = createFixtureRepository({ categories, collections, products });

export async function getVisibleCategories(): Promise<Category[]> {
  return visibleCategories(await repository.listCategories());
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return (await getVisibleCategories()).find((c) => c.slug === slug);
}

export async function getVisibleCollections(): Promise<Collection[]> {
  return visibleCollections(await repository.listCollections());
}

export async function getCollection(slug: string): Promise<Collection | undefined> {
  return (await getVisibleCollections()).find((c) => c.slug === slug);
}

/** Products shown in listings: published and in a visible category. */
export async function getListedProducts(): Promise<Product[]> {
  const cats = new Set((await getVisibleCategories()).map((c) => c.slug));
  return (await repository.listProducts()).filter((p) => isListed(p, cats));
}

/**
 * Product for its page: published or archived (shown as no longer sold).
 * Drafts and products of hidden categories return undefined (404).
 */
export async function getProductForPage(slug: string): Promise<Product | undefined> {
  const product = await repository.findProductBySlug(slug);
  if (!product || product.status === "draft") return undefined;
  const cats = new Set((await getVisibleCategories()).map((c) => c.slug));
  if (!product.categorySlugs.some((s) => cats.has(s))) return undefined;
  return product;
}

export { formatPrice } from "@/lib/format";
