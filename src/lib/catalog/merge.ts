import type { Category, Product } from "@/lib/types";

/**
 * Catalogue seen on the stripe-test preview: the fixtures (src/data), with the
 * records written by the catalogue admin (Firestore `dourya-test`) on top.
 * Pure, so the rules below are unit-tested:
 * - a stored category or product replaces the fixture with the same id, a new
 *   id is added;
 * - demo products (isDemo, e.g. the demo sticker used for the Stripe tests)
 *   can never be replaced, and their slugs stay theirs;
 * - a stored product is never a demo, and is never "published" while sales
 *   are closed (coerced to draft): it stays out of the cart, the checkout and
 *   the sitemap (getListedProducts only lists published products);
 * - a stored record whose slug is already taken by another record is ignored.
 */
export function mergeCategories(fixtures: Category[], stored: Category[]): Category[] {
  const byId = new Map(fixtures.map((c) => [c.id, c]));
  for (const c of stored) {
    const taken = [...byId.values()].some((other) => other.id !== c.id && other.slug === c.slug);
    if (!taken) byId.set(c.id, c);
  }
  return [...byId.values()];
}

export function mergeProducts(fixtures: Product[], stored: Product[]): Product[] {
  const demoIds = new Set(fixtures.filter((p) => p.isDemo).map((p) => p.id));
  const byId = new Map(fixtures.map((p) => [p.id, p]));
  for (const raw of stored) {
    if (demoIds.has(raw.id)) continue;
    const taken = [...byId.values()].some((other) => other.id !== raw.id && other.slug === raw.slug);
    if (taken) continue;
    byId.set(raw.id, { ...raw, isDemo: false, status: raw.status === "published" ? "draft" : raw.status });
  }
  return [...byId.values()];
}
