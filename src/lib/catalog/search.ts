import type { SearchEntry } from "@/components/layout/SearchBox";
import { getShownProducts, getVisibleCategories, getVisibleCollections } from "./index";

/** Entries of the quick search (header) and of the /recherche page: categories, collections, listed products. */
export async function getSearchEntries(): Promise<SearchEntry[]> {
  const [cats, cols, products] = await Promise.all([getVisibleCategories(), getVisibleCollections(), getShownProducts()]);
  const catName = new Map(cats.map((c) => [c.slug, c.name]));
  return [
    ...cats.map((c) => ({ label: c.name, href: `/categories/${c.slug}`, hint: "Catégorie" })),
    ...cols.map((c) => ({ label: c.name, href: `/collections/${c.slug}`, hint: "Collection" })),
    ...products.map((p) => ({
      label: p.name,
      href: `/produits/${p.slug}`,
      hint: p.categorySlugs.map((s) => catName.get(s)).find(Boolean) ?? "",
    })),
  ];
}
