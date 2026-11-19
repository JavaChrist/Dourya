import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { adminDb } from "@/lib/firebase/admin-db";
import type { Category, Product } from "@/lib/types";
import { parseStoredCategory, parseStoredProduct } from "./stored-schema";

/**
 * Catalogue records written by the catalogue admin, in Firestore (`dourya-test`
 * on the stripe-test preview, see admin-gate.ts). Server only: the collections
 * are refused to clients by firestore.rules (catch-all).
 */
export const CATEGORIES_COLLECTION = "catalogCategories";
export const PRODUCTS_COLLECTION = "catalogProducts";

export type StoredCatalog = { categories: Category[]; products: Product[] };

/** Fresh read, for the admin pages and actions. Malformed documents are skipped. */
export async function readStoredCatalog(): Promise<StoredCatalog> {
  const db = adminDb();
  const [cats, prods] = await Promise.all([db.collection(CATEGORIES_COLLECTION).get(), db.collection(PRODUCTS_COLLECTION).get()]);
  const categories = cats.docs.map((d) => parseStoredCategory(d.id, d.data())).filter((c): c is Category => !!c);
  const products = prods.docs.map((d) => parseStoredProduct(d.id, d.data())).filter((p): p is Product => !!p);
  return { categories, products };
}

/** Cached read for the shop pages. The admin actions expire the "catalog" tag after each write. */
export async function cachedStoredCatalog(): Promise<StoredCatalog> {
  "use cache";
  cacheTag("catalog");
  cacheLife("max");
  return readStoredCatalog();
}

export async function readStoredProduct(id: string): Promise<Product | undefined> {
  const doc = await adminDb().collection(PRODUCTS_COLLECTION).doc(id).get();
  return doc.exists ? (parseStoredProduct(doc.id, doc.data()) ?? undefined) : undefined;
}
