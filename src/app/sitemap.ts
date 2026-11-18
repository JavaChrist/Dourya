import type { MetadataRoute } from "next";
import { infoPages, siteOrigin } from "@/config/site";
import { getListedProducts, getVisibleCategories, getVisibleCollections } from "@/lib/catalog";

/**
 * Public pages only, as absolute URLs on the main domain. Built at build time
 * from the catalog: listed products, visible categories and collections.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const [products, categories, collections] = await Promise.all([
    getListedProducts(),
    getVisibleCategories(),
    getVisibleCollections(),
  ]);
  const paths = [
    "/",
    "/boutique",
    ...categories.map((c) => `/categories/${c.slug}`),
    ...collections.map((c) => `/collections/${c.slug}`),
    ...products.map((p) => `/produits/${p.slug}`),
    ...infoPages.map((p) => `/infos/${p.slug}`),
  ];
  return paths.map((path) => ({ url: `${origin}${path === "/" ? "" : path}` }));
}
