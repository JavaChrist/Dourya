import type { Product } from "@/lib/types";
import { photoGalleries, type PhotoGallery } from "./product-galleries.generated";

/**
 * REAL DOURYA creations, one per photo gallery (public/images/products).
 * All are DRAFTS: never listed on the public site, shown only on the
 * stripe-test preview (see lib/catalog/draft-preview.ts) to check the photos.
 *
 * Nothing is invented: no price (priceCents null = "Prix à venir", cannot be
 * added to the cart), no stock count, no format, no description. Names come
 * from the folder names. Main photo = first file, PROPOSED only.
 * Open questions (groupings, names, main photos): docs/validation-lizzie.md.
 */

const DATE = "2026-11-19T00:00:00.000Z";

/** Display names from the folder names (accents restored). To confirm with Lizzie. */
const NAMES: Record<string, string> = {
  "headband-1": "Headband 1",
  "headband-2": "Headband 2",
  "mail-club": "Mail Club",
  "porte-cles-bestiole": "Porte-clés Bestiole",
  "porte-cles-lala": "Porte-clés Lala",
  "porte-cles-nokio": "Porte-clés Nokio",
  "print-chat-roi-1": "Print Chat Roi 1",
  "print-chat-roi-2": "Print Chat Roi 2",
  "print-chat-roi-3": "Print Chat Roi 3",
  "print-doggo-1": "Print Doggo 1",
  "print-doggo-2": "Print Doggo 2",
  "print-gros-dodo": "Print Gros Dodo",
  "print-grozyeux-1": "Print Grozyeux 1",
  "print-grozyeux-2": "Print Grozyeux 2",
  "print-twilight": "Print Twilight",
  "sticker-pack-bookish": "Pack de stickers Bookish",
  "sticker-pack-coquette": "Pack de stickers Coquette",
  "sticker-pack-doggo": "Pack de stickers Doggo",
  "sticker-pack-notendo": "Pack de stickers Notendo",
  "sticker-pack-papillons": "Pack de stickers Papillons",
  "sticker-pack-poiscailles": "Pack de stickers Poiscailles",
  "sticker-pack-twilight": "Pack de stickers Twilight",
  "sticker-pack-witchy": "Pack de stickers Witchy",
  "sticker-chaton-mystere": "Sticker Chaton mystère",
  "sticker-doudou-lapin": "Sticker Doudou lapin",
  "sticker-fee": "Sticker Fée",
  "sticker-milk": "Sticker Milk",
  "sticker-nokio": "Sticker Nokio",
  "sticker-telephone-a-clapet": "Sticker Téléphone à clapet",
};

function draftProduct(g: PhotoGallery): Product {
  const name = NAMES[g.slug] ?? g.folder;
  return {
    id: `real-${g.slug}`,
    slug: g.slug,
    name,
    description: "",
    status: "draft",
    categorySlugs: g.category ? [g.category] : [],
    collectionSlugs: [],
    images: g.images.map((img, i) => ({
      src: img.src,
      width: img.width,
      height: img.height,
      alt: `${name}, photo ${i + 1} sur ${g.images.length}`,
    })),
    // One placeholder variant: no price, no stock count, no format until Lizzie sets them.
    variants: [{ id: "a-definir", sku: `A-DEFINIR-${g.slug.toUpperCase()}`, name: "À définir", attributes: [], priceCents: null, stockMode: "stocked", stock: null, active: true }],
    isDemo: false,
    createdAt: DATE,
    updatedAt: DATE,
  };
}

export const realProducts: Product[] = photoGalleries.map(draftProduct);
