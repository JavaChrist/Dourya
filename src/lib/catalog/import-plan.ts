import type { Product } from "@/lib/types";

/**
 * Import of the real DOURYA drafts (src/data/real-products.ts, one per photo
 * gallery + the Twilight pack) into the stored catalogue (`dourya-test`).
 * Pure (type imports only) so the import script can load it with plain Node,
 * and unit-tested.
 * - a product already stored is skipped: an edit made in the admin is never
 *   overwritten;
 * - everything is written as a draft (status "published" is never written);
 * - the existing WebP photos under /images/products/** are referenced, not copied.
 */

/** Firestore document of a stored product (same shape for the admin and the import). */
export function toStoredProductDoc(p: Product, now: string) {
  return {
    slug: p.slug,
    name: p.name,
    description: p.description,
    status: p.status === "published" ? "draft" : p.status,
    categorySlugs: p.categorySlugs,
    collectionSlugs: p.collectionSlugs,
    images: p.images.map((i) => ({ src: i.src, alt: i.alt, width: i.width, height: i.height, ...(i.storagePath ? { storagePath: i.storagePath } : {}) })),
    variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, name: v.name, priceCents: v.priceCents, stockMode: v.stockMode, stock: v.stock ?? null, active: v.active })),
    createdAt: p.createdAt || now,
    updatedAt: now,
  };
}

export type ImportLine = {
  id: string;
  slug: string;
  name: string;
  action: "create" | "skip";
  priceCents: number | null;
  cover: string | null;
  images: number;
  categories: string[];
};

/** problems block the import; notes are shown but do not block it. */
export type ImportPlan = { lines: ImportLine[]; create: number; skip: number; problems: string[]; notes: string[] };

export const PUBLIC_PHOTO_PREFIX = "/images/products/";

export function planImport(products: Product[], storedIds: ReadonlySet<string>): ImportPlan {
  const problems: string[] = [];
  const notes: string[] = [];
  const seenSlugs = new Set<string>();
  const lines = products.map((p): ImportLine => {
    if (p.isDemo) problems.push(`${p.id}: produit de démonstration, jamais importé`);
    if (seenSlugs.has(p.slug)) problems.push(`${p.id}: slug en double (${p.slug})`);
    seenSlugs.add(p.slug);
    if (p.images.length === 0) problems.push(`${p.id}: aucune photo`);
    if (p.images.some((i) => !i.src.startsWith(PUBLIC_PHOTO_PREFIX))) problems.push(`${p.id}: photo hors de ${PUBLIC_PHOTO_PREFIX}`);
    if (p.categorySlugs.length === 0) notes.push(`${p.id}: aucune rubrique (à choisir dans l’admin avant de modifier la fiche)`);
    const prices = p.variants.map((v) => v.priceCents).filter((c): c is number => c !== null);
    if (prices.length === 0) problems.push(`${p.id}: prix manquant`);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      action: storedIds.has(p.id) || p.isDemo ? "skip" : "create",
      priceCents: prices.length ? Math.min(...prices) : null,
      cover: p.images[0]?.src ?? null,
      images: p.images.length,
      categories: p.categorySlugs,
    };
  });
  return { lines, create: lines.filter((l) => l.action === "create").length, skip: lines.filter((l) => l.action === "skip").length, problems, notes };
}
