import "server-only";
import { photoGalleries } from "@/data/product-galleries.generated";
import { adminCatalog } from "@/lib/catalog/admin-repository";
import { imageChoices, type HomeAllowed, type ImageChoice } from "./carousels";

export type LinkChoice = { slug: string; name: string; /** Shown in the shop right now? Else the slide waits. */ live: boolean; note?: string };
export type HomeOptions = { images: ImageChoice[]; categories: LinkChoice[]; products: LinkChoice[] };

const STATUS = { draft: "brouillon", published: "publié", archived: "archivé" } as const;

/**
 * What Admin → Accueil offers, from a fresh read of the merged catalogue:
 * every rubrique (hidden ones too: the slide appears once it is visible),
 * every non-demo product, and their photos plus the photo galleries.
 */
export async function homeAdminOptions(): Promise<HomeOptions> {
  const { categories, products, visibleInShop } = await adminCatalog();
  const real = products.filter((p) => !p.isDemo);
  return {
    images: imageChoices(real, photoGalleries),
    categories: categories.map((c) => ({ slug: c.slug, name: c.name, live: visibleInShop.has(c.slug), ...(visibleInShop.has(c.slug) ? {} : { note: "masquée" }) })),
    products: real.map((p) => {
      const live = p.status === "published" && p.categorySlugs.some((s) => visibleInShop.has(s));
      return { slug: p.slug, name: p.name, live, ...(live ? {} : { note: p.status === "published" ? "rubrique masquée" : STATUS[p.status] }) };
    }),
  };
}

/** The same options as sets, for the server-side validation. */
export function allowedFrom(options: HomeOptions): HomeAllowed {
  return {
    images: new Map(options.images.map((i) => [i.src, { width: i.width, height: i.height }])),
    categorySlugs: new Set(options.categories.map((c) => c.slug)),
    productSlugs: new Set(options.products.map((p) => p.slug)),
  };
}
