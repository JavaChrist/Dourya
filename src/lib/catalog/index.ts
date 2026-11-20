import type { Category, Collection, Product } from "@/lib/types";
import { catalogAdminState } from "./admin-gate";
import { isDemoShown, withoutDemo } from "./demo";
import { isDraftPreview } from "./draft-preview";
import { createFixtureRepository } from "./fixture-repository";
import { fixtures } from "./fixtures";
import { shopCatalog } from "./merge";
import type { CatalogRepository } from "./repository";
import { isListed, isShown, visibleCategories, visibleCollections } from "./visibility";

/**
 * Public catalogue API used by pages and server actions.
 *
 * Fixtures (src/data) everywhere. Where the catalogue admin is open
 * (admin-gate.ts), the records it wrote are added (merge.ts shopCatalog):
 * - dourya.fr (mode "production"): the NEW visible rubriques and the NEW
 *   published products that are still ready (publish.ts). A fixture or a demo
 *   product is never replaced, a slug already taken is ignored, drafts and
 *   archived records stay private. Payment stays closed (checkoutEnabled).
 * - stripe-test preview (mode "test"): the stored records on top of the
 *   fixtures; a stored product is published by the same rules, else a draft.
 *
 * Fixture-only repository (kept for the tests and as the fallback). */
export const repository: CatalogRepository = createFixtureRepository(fixtures);

/** Loaded once, on demand: server-only, and the fixture path stays importable by the unit tests. */
let storedModule: Promise<typeof import("./stored-catalog")> | undefined;
const loadStored = () =>
  (storedModule ??= import("./stored-catalog").catch((error: unknown) => {
    storedModule = undefined;
    throw error;
  }));

/**
 * Shop repository for this deployment. The demo content (isDemo) is removed
 * on dourya.fr only (demo.ts), after the merge: a stored product still cannot
 * take the slug of a demo product.
 */
function shopRepository(catalog: { categories: Category[]; products: Product[] }): CatalogRepository {
  const demo = isDemoShown(process.env);
  if (demo && catalog.products === fixtures.products) return repository;
  return createFixtureRepository({
    categories: catalog.categories,
    collections: withoutDemo(fixtures.collections, demo),
    products: withoutDemo(catalog.products, demo),
  });
}

async function currentRepository(): Promise<CatalogRepository> {
  const state = catalogAdminState(process.env);
  if (!state.enabled) return shopRepository(fixtures);
  try {
    const { cachedStoredCatalog } = await loadStored();
    return shopRepository(shopCatalog(state.mode, fixtures, await cachedStoredCatalog()));
  } catch (error) {
    // Loaded here: lib/log is server-only, and the fixture path stays importable by the unit tests.
    const { errorCode, logEvent } = await import("@/lib/log");
    logEvent("catalog_store_read_error", { code: errorCode(error) });
    return shopRepository(fixtures);
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
