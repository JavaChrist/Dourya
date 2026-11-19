import { categories } from "@/data/categories";
import { collections } from "@/data/collections";
import { products as demoProducts } from "@/data/products";
import { realProducts } from "@/data/real-products";
import type { Category, Collection, Product } from "@/lib/types";
import { isDraftPreview } from "./draft-preview";
import { createFixtureRepository } from "./fixture-repository";
import type { CatalogRepository } from "./repository";
import { isListed, isShown, visibleCategories, visibleCollections } from "./visibility";

/**
 * Public catalogue API used by pages and server actions.
 * To switch to Firestore, replace `repository` with a Firestore implementation
 * of CatalogRepository: nothing else changes.
 */
export const repository: CatalogRepository = createFixtureRepository({ categories, collections, products: [...demoProducts, ...realProducts] });

/** Drafts visible here? Only on the stripe-test preview and in local dev (see draft-preview.ts). */
const draftsShown = () => isDraftPreview(process.env);

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

/**
 * Products for sale: published and in a visible category. Used by the cart,
 * the checkout and the sitemap: never includes drafts, even on the preview.
 */
export async function getListedProducts(): Promise<Product[]> {
  const cats = new Set((await getVisibleCategories()).map((c) => c.slug));
  return (await repository.listProducts()).filter((p) => isListed(p, cats));
}

/**
 * Products shown in the shop pages and the search: the listed ones, plus the
 * drafts on the draft preview only (shown with a badge, never purchasable).
 */
export async function getShownProducts(): Promise<Product[]> {
  const cats = new Set((await getVisibleCategories()).map((c) => c.slug));
  const drafts = draftsShown();
  return (await repository.listProducts()).filter((p) => isShown(p, cats, drafts));
}

/**
 * Product for its page: published or archived (shown as no longer sold).
 * Drafts and products of hidden categories return undefined (404); on the
 * draft preview a draft is returned, whatever its category.
 */
export async function getProductForPage(slug: string): Promise<Product | undefined> {
  const product = await repository.findProductBySlug(slug);
  if (!product) return undefined;
  if (product.status === "draft") return draftsShown() ? product : undefined;
  const cats = new Set((await getVisibleCategories()).map((c) => c.slug));
  if (!product.categorySlugs.some((s) => cats.has(s))) return undefined;
  return product;
}

export { formatPrice } from "@/lib/format";
