import type { Category, Collection, Product } from "@/lib/types";
import type { CatalogRepository } from "./repository";

/** In-memory repository over isolated test data. Used until Firestore is wired. */
export function createFixtureRepository(data: {
  categories: Category[];
  collections: Collection[];
  products: Product[];
}): CatalogRepository {
  return {
    listCategories: async () => data.categories,
    listCollections: async () => data.collections,
    listProducts: async () => data.products,
    findProductBySlug: async (slug) => data.products.find((p) => p.slug === slug),
    findProductsByIds: async (ids) => {
      const wanted = new Set(ids);
      return data.products.filter((p) => wanted.has(p.id));
    },
  };
}
