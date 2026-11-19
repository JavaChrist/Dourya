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

/** A stored record as the shop sees it: public when published and ready, otherwise a draft (never listed). */
const asShopProduct = (p: Product, visibleCategorySlugs: ReadonlySet<string>): Product =>
  p.status === "published" && isReadyToPublish(p, visibleCategorySlugs) ? toPublicProduct(p) : { ...p, isDemo: false, status: "draft" };

/**
 * Products of the shop of dourya.fr.
 * - A stored record with the id of a code product that is not a demo (the
 *   real creations of src/data/real-products.ts) takes its place: the fiche is
 *   then managed from the admin (photos, price, stock, « Publier »). It must
 *   keep the same slug (the admin never changes it).
 * - A NEW stored product is added when it is published and ready.
 * - Demo products (Stripe tests) are never replaced, and no stored record may
 *   take the slug of another product.
 * The readiness is checked again here: a product that is no longer ready
 * leaves the shop. Drafts and archived records never reach it.
 */
export function addPublishedProducts(fixtures: Product[], stored: Product[], visibleCategorySlugs: ReadonlySet<string>): Product[] {
  const byId = new Map(fixtures.map((p) => [p.id, p]));
  const replaced = new Map<string, Product>();
  const slugs = new Set(fixtures.map((p) => p.slug));
  const added: Product[] = [];
  for (const p of stored) {
    const fixture = byId.get(p.id);
    if (fixture) {
      if (!fixture.isDemo && fixture.slug === p.slug) replaced.set(p.id, asShopProduct(p, visibleCategorySlugs));
      continue;
    }
    if (p.status !== "published" || slugs.has(p.slug) || !isReadyToPublish(p, visibleCategorySlugs)) continue;
    slugs.add(p.slug);
    added.push(toPublicProduct(p));
  }
  return [...fixtures.map((p) => replaced.get(p.id) ?? p), ...added];
}

/**
 * Products of the stripe-test preview: the admin merge, where a stored product
 * is "published" only by the same rules as on dourya.fr (ready); otherwise it
 * is shown as a draft (preview only, never in the cart).
 */
export function previewProducts(fixtures: Product[], stored: Product[], visibleCategorySlugs: ReadonlySet<string>): Product[] {
  const storedIds = new Set(stored.map((p) => p.id));
  return mergeProducts(fixtures, stored).map((p) => {
    if (p.isDemo || !storedIds.has(p.id) || p.status !== "published") return p;
    return asShopProduct(p, visibleCategorySlugs);
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
