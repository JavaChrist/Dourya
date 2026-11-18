import type { Category, Collection, Product } from "@/lib/types";

/**
 * Raw catalogue storage. It returns every record, whatever its status or
 * visibility: publication rules live in catalog/visibility.ts, so a new
 * storage (Firestore) only has to implement these reads.
 *
 * Methods are async on purpose: the Firestore implementation will be.
 */
export interface CatalogRepository {
  listCategories(): Promise<Category[]>;
  listCollections(): Promise<Collection[]>;
  listProducts(): Promise<Product[]>;
  findProductBySlug(slug: string): Promise<Product | undefined>;
  findProductsByIds(ids: string[]): Promise<Product[]>;
}
