import type { Category, Product } from "@/lib/types";
import type { CatalogAdminMode } from "./admin-gate";
import { isReadyToPublish, toPublicProduct } from "./publish";
import { visibleCategories } from "./visibility";

/**
 * Merges of the fixtures (src/data) with the records written by the catalogue
 * admin (Firestore). Pure, so the rules below are unit-tested.
 */

/**
 * Admin view (and base of the stripe-test preview): a stored category or
 * product replaces the fixture with the same id, a new id is added; a stored
 * record whose slug is already taken by another record is ignored.
 */
export function mergeCategories(fixtures: Category[], stored: Category[]): Category[] {
  const byId = new Map(fixtures.map((c) => [c.id, c]));
  for (const c of stored) {
    const taken = [...byId.values()].some((other) => other.id !== c.id && other.slug === c.slug);
    if (!taken) byId.set(c.id, c);
  }
  return [...byId.values()];
}

/**
 * Rubriques seen on dourya.fr: the fixture categories, plus the NEW visible
 * rubriques created in the catalogue admin. A stored record can never replace,
 * hide or rename a fixture category there (same id or same slug is ignored).
 */
export function addStoredCategories(fixtures: Category[], stored: Category[]): Category[] {
  const ids = new Set(fixtures.map((c) => c.id));
  const slugs = new Set(fixtures.map((c) => c.slug));
  const added: Category[] = [];
  for (const c of stored) {
    if (!c.visible || ids.has(c.id) || slugs.has(c.slug)) continue;
    ids.add(c.id);
    slugs.add(c.slug);
    added.push(c);
  }
  return [...fixtures, ...added];
}

/**
 * Admin view of the products: the stored records on top of the fixtures, with
 * their real status. Demo products (isDemo, e.g. the demo sticker used for the
 * Stripe tests) can never be replaced, and their slugs stay theirs; a stored
 * product is never a demo.
 */
export function mergeProducts(fixtures: Product[], stored: Product[]): Product[] {
  const demoIds = new Set(fixtures.filter((p) => p.isDemo).map((p) => p.id));
  const byId = new Map(fixtures.map((p) => [p.id, p]));
  for (const raw of stored) {
    if (demoIds.has(raw.id)) continue;
    const taken = [...byId.values()].some((other) => other.id !== raw.id && other.slug === raw.slug);
    if (taken) continue;
    byId.set(raw.id, { ...raw, isDemo: false });
  }
  return [...byId.values()];
}

/**
 * Published stored products added to the shop of dourya.fr. Only NEW products:
 * a stored record with the id or the slug of a fixture (demo or not) is
 * ignored, so the code catalogue and the demo sticker stay as they are. The
 * readiness is checked again here: a product that is no longer ready is left
 * out. Drafts and archived records never reach the shop.
 */
export function addPublishedProducts(fixtures: Product[], stored: Product[], visibleCategorySlugs: ReadonlySet<string>): Product[] {
  const ids = new Set(fixtures.map((p) => p.id));
  const slugs = new Set(fixtures.map((p) => p.slug));
  const added: Product[] = [];
  for (const p of stored) {
    if (p.status !== "published" || ids.has(p.id) || slugs.has(p.slug) || !isReadyToPublish(p, visibleCategorySlugs)) continue;
    ids.add(p.id);
    slugs.add(p.slug);
    added.push(toPublicProduct(p));
  }
  return [...fixtures, ...added];
}

/**
 * Products of the stripe-test preview: the admin merge, where a stored product
 * is "published" only by the same rules as on dourya.fr (new id, ready);
 * otherwise it is shown as a draft (preview only, never in the cart).
 */
export function previewProducts(fixtures: Product[], stored: Product[], visibleCategorySlugs: ReadonlySet<string>): Product[] {
  const fixtureIds = new Set(fixtures.map((p) => p.id));
  const storedIds = new Set(stored.map((p) => p.id));
  return mergeProducts(fixtures, stored).map((p) => {
    if (p.isDemo || !storedIds.has(p.id) || p.status !== "published") return p;
    return !fixtureIds.has(p.id) && isReadyToPublish(p, visibleCategorySlugs) ? toPublicProduct(p) : { ...p, status: "draft" };
  });
}

export const visibleSlugs = (categories: Category[]): Set<string> => new Set(visibleCategories(categories).map((c) => c.slug));

/** Catalogue of the shop pages, cart and sitemap, by admin mode (see admin-gate.ts). */
export function shopCatalog(mode: CatalogAdminMode, fixtures: { categories: Category[]; products: Product[] }, stored: { categories: Category[]; products: Product[] }) {
  const categories = mode === "production" ? addStoredCategories(fixtures.categories, stored.categories) : mergeCategories(fixtures.categories, stored.categories);
  const visible = visibleSlugs(categories);
  const products = mode === "production" ? addPublishedProducts(fixtures.products, stored.products, visible) : previewProducts(fixtures.products, stored.products, visible);
  return { categories, products, visible };
}
