import type { Category, Collection, Product } from "@/lib/types";
import { catalogAdminEnabled } from "./admin-gate";
import { isDraftPreview } from "./draft-preview";
import { createFixtureRepository } from "./fixture-repository";
import { fixtures } from "./fixtures";
import { mergeCategories, mergeProducts } from "./merge";
import type { CatalogRepository } from "./repository";
import { isListed, isShown, visibleCategories, visibleCollections } from "./visibility";

/**
 * Public catalogue API used by pages and server actions.
 *
 * Fixtures (src/data) everywhere. On the stripe-test preview only (database
 * `dourya-test`, see admin-gate.ts), the records written by the catalogue
 * admin are merged on top (merge.ts: demo products stay untouched, stored
 * products are always drafts). dourya.fr never reads Firestore for the
 * catalogue.
 *
 * Fixture-only repository (kept for the tests and as the fallback). */
export const repository: CatalogRepository = createFixtureRepository(fixtures);

async function currentRepository(): Promise<CatalogRepository> {
  if (!catalogAdminEnabled(process.env)) return repository;
  try {
    const { cachedStoredCatalog } = await import("./stored-catalog");
    const stored = await cachedStoredCatalog();
    return createFixtureRepository({
      categories: mergeCategories(fixtures.categories, stored.categories),
      collections: fixtures.collections,
      products: mergeProducts(fixtures.products, stored.products),
    });
  } catch (error) {
    // Loaded here: lib/log is server-only, and the fixture path stays importable by the unit tests.
    const { errorCode, logEvent } = await import("@/lib/log");
    logEvent("catalog_store_read_error", { code: errorCode(error) });
    return repository;
  }
}

/** Drafts visible here? Only on the stripe-test preview and in local dev (see draft-preview.ts). */
const draftsShown = () => isDraftPreview(process.env);

export async function getVisibleCategories(): Promise<Category[]> {
  return visibleCategories(await (await currentRepository()).listCategories());
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return (await getVisibleCategories()).find((c) => c.slug === slug);
}

export async function getVisibleCollections(): Promise<Collection[]> {
  return visibleCollections(await (await currentRepository()).listCollections());
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
  return (await (await currentRepository()).listProducts()).filter((p) => isListed(p, cats));
}

/**
 * Products shown in the shop pages and the search: the listed ones, plus the
 * drafts on the draft preview only (shown with a badge, never purchasable).
 */
export async function getShownProducts(): Promise<Product[]> {
  const cats = new Set((await getVisibleCategories()).map((c) => c.slug));
  const drafts = draftsShown();
  return (await (await currentRepository()).listProducts()).filter((p) => isShown(p, cats, drafts));
}

/**
 * Product for its page: published or archived (shown as no longer sold).
 * Drafts and products of hidden categories return undefined (404); on the
 * draft preview a draft is returned, whatever its category.
 */
export async function getProductForPage(slug: string): Promise<Product | undefined> {
  const product = await (await currentRepository()).findProductBySlug(slug);
  if (!product) return undefined;
  if (product.status === "draft") return draftsShown() ? product : undefined;
  const cats = new Set((await getVisibleCategories()).map((c) => c.slug));
  if (!product.categorySlugs.some((s) => cats.has(s))) return undefined;
  return product;
}

export { formatPrice } from "@/lib/format";
