import "server-only";
import { randomBytes } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin-db";
import type { Category, ImageAsset, Product, PublishStatus } from "@/lib/types";
import { catalogAdminEnabled, catalogAdminState, draftPhotoUrl } from "./admin-gate";
import { CatalogClosedError, deleteDraftPhoto, saveDraftPhoto } from "./admin-storage";
import { fixtures } from "./fixtures";
import { toStoredProductDoc } from "./import-plan";
import { mergeCategories, mergeProducts, shopCatalog } from "./merge";
import { READINESS_LABEL, isReadyToPublish, publishReadiness } from "./publish";
import { CATEGORIES_COLLECTION, PRODUCTS_COLLECTION, readStoredCatalog } from "./stored-catalog";
import { MAX_IMAGES, linkVariantImages, parseStoredProduct, toVariant, type CategoryInput, type ProductInput } from "./stored-schema";

/**
 * Writes of the catalogue admin (Firestore "(default)" on dourya.fr or `dourya-test` on the preview, + Storage
 * `catalog-drafts/`). Every function refuses when the admin is closed here
 * (admin-gate.ts), on top of the check in the actions.
 */
function assertOpen() {
  if (!catalogAdminEnabled(process.env)) throw new CatalogClosedError();
}

/** Raised for an expected refusal; `message` is shown to the admin as is. */
export class CatalogRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogRefusal";
  }
}

export type AdminCatalog = {
  categories: Category[];
  products: Product[];
  storedProductIds: Set<string>;
  storedCategoryIds: Set<string>;
  /** Rubriques visible in the shop of this deployment (readiness check, see publish.ts). */
  visibleInShop: Set<string>;
};

/** Fresh merged catalogue for the admin pages (all statuses, hidden categories included). */
export async function adminCatalog(): Promise<AdminCatalog> {
  const state = catalogAdminState(process.env);
  if (!state.enabled) throw new CatalogClosedError();
  const stored = await readStoredCatalog();
  return {
    visibleInShop: shopCatalog(state.mode, fixtures, stored).visible,
    categories: mergeCategories(fixtures.categories, stored.categories).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "fr")),
    products: mergeProducts(fixtures.products, stored.products).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    storedProductIds: new Set(stored.products.map((p) => p.id)),
    storedCategoryIds: new Set(stored.categories.map((c) => c.id)),
  };
}

const demoIds = new Set(fixtures.products.filter((p) => p.isDemo).map((p) => p.id));
export const isDemoProduct = (id: string) => demoIds.has(id);

// ---- Categories -------------------------------------------------------------

export async function saveCategory(input: CategoryInput): Promise<Category> {
  assertOpen();
  const { categories } = await adminCatalog();
  const existing = input.id ? categories.find((c) => c.id === input.id) : undefined;
  if (input.id && !existing) throw new CatalogRefusal("Rubrique introuvable.");
  // The slug is the URL key: fixed once the rubrique exists.
  const slug = existing ? existing.slug : input.slug;
  const id = existing ? existing.id : `cat-${slug}`;
  if (categories.some((c) => c.id !== id && c.slug === slug) || (!existing && categories.some((c) => c.id === id)))
    throw new CatalogRefusal("Une rubrique utilise déjà cette adresse.");
  const category: Category = { id, slug, name: input.name, icon: input.icon, visible: input.visible, order: input.order };
  if (input.description) category.description = input.description;
  await adminDb().collection(CATEGORIES_COLLECTION).doc(id).set({ ...category, updatedAt: new Date().toISOString() });
  return category;
}

// ---- Products ---------------------------------------------------------------

const toDoc = (p: Product) => toStoredProductDoc(p, new Date().toISOString());

/**
 * Saves the form. The status is kept (the form has none), except that a
 * published product which is no longer ready after the change goes back to
 * draft (`unpublished`), so the shop never shows an incomplete product.
 */
export async function saveProduct(input: ProductInput): Promise<{ product: Product; unpublished: boolean }> {
  assertOpen();
  const { products, visibleInShop } = await adminCatalog();
  if (input.id && isDemoProduct(input.id)) throw new CatalogRefusal("Les produits de démonstration ne se modifient pas ici.");
  const existing = input.id ? products.find((p) => p.id === input.id) : undefined;
  if (input.id && !existing) throw new CatalogRefusal("Fiche introuvable.");
  const slug = existing ? existing.slug : input.slug;
  const id = existing ? existing.id : `p-${slug}`;
  if (products.some((p) => p.id !== id && p.slug === slug) || (!existing && products.some((p) => p.id === id)))
    throw new CatalogRefusal("Une fiche utilise déjà cette adresse. Changez le nom ou l'adresse.");
  const now = new Date().toISOString();
  const product: Product = {
    id,
    slug,
    name: input.name,
    description: input.description,
    status: input.status ?? existing?.status ?? "draft",
    categorySlugs: input.categorySlugs,
    collectionSlugs: existing?.collectionSlugs ?? [],
    images: existing?.images ?? [],
    variants: linkVariantImages(input.variants.map((v) => toVariant(slug, v)), existing?.images ?? []),
    isDemo: false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const unpublished = product.status === "published" && !isReadyToPublish(product, visibleInShop);
  if (unpublished) product.status = "draft";
  // toDoc() writes "published" as a draft (import rule): the status checked above is written explicitly.
  await adminDb().collection(PRODUCTS_COLLECTION).doc(id).set({ ...toDoc(product), status: product.status });
  return { product, unpublished };
}

/**
 * « Publier », « Repasser en brouillon », « Archiver ». Publishing re-checks
 * the readiness on the stored record, inside the transaction (a product of
 * the code catalogue is copied there on its first change, see merge.ts); a
 * demo product is never changed from here.
 */
export async function setProductStatus(productId: string, status: PublishStatus): Promise<void> {
  assertOpen();
  if (isDemoProduct(productId)) throw new CatalogRefusal("Les produits de démonstration ne se modifient pas ici.");
  const { products, visibleInShop } = await adminCatalog();
  const db = adminDb();
  const ref = db.collection(PRODUCTS_COLLECTION).doc(productId);
  const fixture = fixtures.products.find((p) => p.id === productId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const base = snap.exists ? (parseStoredProduct(snap.id, snap.data()) ?? undefined) : fixture;
    if (!base) throw new CatalogRefusal("Fiche introuvable. Enregistrez d'abord la fiche.");
    if (status === "published") {
      const issues = publishReadiness(base, visibleInShop);
      if (issues.length) throw new CatalogRefusal(`La fiche n'est pas prête : ${issues.map((i) => READINESS_LABEL[i]).join(" ")}`);
      if (products.some((p) => p.id !== productId && p.slug === base.slug)) throw new CatalogRefusal("Une autre fiche utilise déjà cette adresse.");
    }
    const now = new Date().toISOString();
    if (snap.exists) tx.update(ref, { status, updatedAt: now });
    else tx.set(ref, { ...toDoc({ ...base, status }), status });
  });
}

/**
 * Runs `change` on the product's images in a transaction. A fixture product
 * not yet stored (e.g. a real draft before the import) is copied first.
 */
async function updateImages(productId: string, change: (images: ImageAsset[]) => ImageAsset[]): Promise<ImageAsset[]> {
  assertOpen();
  if (isDemoProduct(productId)) throw new CatalogRefusal("Les produits de démonstration ne se modifient pas ici.");
  const db = adminDb();
  const ref = db.collection(PRODUCTS_COLLECTION).doc(productId);
  const fixture = fixtures.products.find((p) => p.id === productId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const base = snap.exists ? (parseStoredProduct(snap.id, snap.data()) ?? undefined) : fixture;
    if (!base) throw new CatalogRefusal("Fiche introuvable. Enregistrez d'abord la fiche.");
    const images = change([...base.images]);
    if (snap.exists) tx.update(ref, { images: toDoc({ ...base, images }).images, updatedAt: new Date().toISOString() });
    else tx.set(ref, toDoc({ ...base, images }));
    return images;
  });
}

export async function addPhoto(productId: string, kind: "webp" | "jpg", bytes: Uint8Array, size: { width: number; height: number }, alt: string): Promise<void> {
  assertOpen();
  const { products } = await adminCatalog();
  const product = products.find((p) => p.id === productId);
  if (!product) throw new CatalogRefusal("Fiche introuvable. Enregistrez d'abord la fiche.");
  if (product.images.length >= MAX_IMAGES) throw new CatalogRefusal(`${MAX_IMAGES} photos au maximum par fiche.`);
  const file = `${randomBytes(12).toString("hex")}.${kind}`;
  const storagePath = await saveDraftPhoto(productId, file, kind, bytes);
  try {
    await updateImages(productId, (images) => {
      if (images.length >= MAX_IMAGES) throw new CatalogRefusal(`${MAX_IMAGES} photos au maximum par fiche.`);
      return [...images, { src: draftPhotoUrl(productId, file), alt: alt || product.name, width: size.width, height: size.height, storagePath }];
    });
  } catch (error) {
    await deleteDraftPhoto(storagePath).catch(() => undefined);
    throw error;
  }
}

export type PhotoEdit = { op: "up" | "down" | "cover" | "delete" } | { op: "alt"; alt: string };

export async function editPhoto(productId: string, src: string, edit: PhotoEdit): Promise<void> {
  let removed: ImageAsset | undefined;
  await updateImages(productId, (images) => {
    const i = images.findIndex((img) => img.src === src);
    if (i < 0) throw new CatalogRefusal("Photo introuvable.");
    const next = [...images];
    const swap = (a: number, b: number) => ([next[a], next[b]] = [next[b], next[a]]);
    if (edit.op === "up" && i > 0) swap(i, i - 1);
    else if (edit.op === "down" && i < next.length - 1) swap(i, i + 1);
    else if (edit.op === "cover" && i > 0) next.unshift(...next.splice(i, 1));
    else if (edit.op === "alt") next[i] = { ...next[i], alt: edit.alt };
    else if (edit.op === "delete") removed = next.splice(i, 1)[0];
    return next;
  });
  // Only draft photos are deleted from Storage; the existing WebP of /products/** stay.
  if (removed?.storagePath) await deleteDraftPhoto(removed.storagePath);
}
