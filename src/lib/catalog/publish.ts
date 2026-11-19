import type { Product } from "@/lib/types";
import { PUBLIC_PHOTO_ROUTE, toPublicPhotoUrl } from "./draft-photo-url";
import { stockToValidate } from "./visibility";

/**
 * Publication of the products written by the catalogue admin. Pure,
 * unit-tested. The same check runs:
 * - in the admin, to enable the « Publier » button and list what is missing;
 * - in the server action, before the status is written;
 * - at every read of the shop (merge.ts): a published product that is no
 *   longer ready (photo removed, rubrique hidden...) leaves the shop by itself.
 */
export type ReadinessIssue = "photo" | "alt" | "price" | "stock" | "category" | "description";

export const READINESS_LABEL: Record<ReadinessIssue, string> = {
  photo: "Ajoutez au moins une photo.",
  alt: "Chaque photo doit avoir un texte alternatif.",
  price: "Au moins un modèle ou une option en vente doit avoir un prix.",
  stock: "Indiquez la quantité de chaque modèle en stock limité (ou choisissez « Fait à la demande »).",
  category: "Choisissez au moins une rubrique visible dans la boutique.",
  description: "Écrivez une description.",
};

/** What is missing before `product` can be published; empty = « Prêt à publier ». */
export function publishReadiness(product: Product, visibleCategorySlugs: ReadonlySet<string>): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  if (product.images.length === 0) issues.push("photo");
  else if (product.images.some((i) => !i.alt?.trim())) issues.push("alt");
  const onSale = product.variants.filter((v) => v.active);
  if (!onSale.some((v) => v.priceCents !== null && v.priceCents > 0)) issues.push("price");
  if (onSale.some(stockToValidate)) issues.push("stock");
  if (!product.categorySlugs.some((s) => visibleCategorySlugs.has(s))) issues.push("category");
  if (!product.description.trim()) issues.push("description");
  return issues;
}

export const isReadyToPublish = (product: Product, visibleCategorySlugs: ReadonlySet<string>) => publishReadiness(product, visibleCategorySlugs).length === 0;

/**
 * Product as shown by the public shop: its uploaded photos point to the public
 * photo route (the admin route stays private), the Storage paths are dropped.
 */
export function toPublicProduct(product: Product): Product {
  return {
    ...product,
    isDemo: false,
    images: product.images.map((image) => ({ src: toPublicPhotoUrl(image.src), alt: image.alt, width: image.width, height: image.height })),
    variants: product.variants.map((v) => (v.imageSrc ? { ...v, imageSrc: toPublicPhotoUrl(v.imageSrc) } : v)),
  };
}

/** The public photo route serves `file` only when it is a photo of `productId`, listed in the shop right now. */
export function isListedPhoto(listed: readonly Product[], productId: string, file: string): boolean {
  const src = `${PUBLIC_PHOTO_ROUTE}/${productId}/${file}`;
  return listed.some((p) => p.id === productId && p.status === "published" && p.images.some((i) => i.src === src));
}
