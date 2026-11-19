import type { Product, ProductVariant } from "@/lib/types";
import { photoGalleries, type PhotoGallery } from "./product-galleries.generated";

/**
 * REAL DOURYA creations, one per photo gallery (public/images/products), plus
 * the complete Twilight print pack (same photos as the single Twilight print).
 * All are DRAFTS: never listed on the public site, shown only on the
 * stripe-test preview (see lib/catalog/draft-preview.ts).
 *
 * Prices: the grid validated on 2026-11-19, in cents. Stock: not set yet
 * ("Stock à valider"), so nothing can be added to the cart even once published.
 * Names come from the folder names. Open questions: docs/validation-lizzie.md.
 */

const DATE = "2026-11-19T00:00:00.000Z";

/** Validated price grid, in cents, by kind of product. */
export const PRICE_CENTS = {
  sticker: 195,
  "sticker-pack": 695,
  print: 695,
  "print-pack": 2995,
  "porte-cles": 595,
  "blindbox-lala": 650,
  "blindbox-chaton-mystere": 195,
  headband: 995,
  "mail-club": 1195,
} as const;
type PriceKind = keyof typeof PRICE_CENTS;

type Entry = { slug: string; name: string; price: PriceKind; description?: string };

/** Gallery slug -> product. Display names to confirm with Lizzie. */
const PRODUCTS: Record<string, Entry> = {
  "headband-1": { slug: "headband-1", name: "Headband 1", price: "headband" },
  "headband-2": { slug: "headband-2", name: "Headband 2", price: "headband" },
  "mail-club": { slug: "dopamine-mailclub", name: "Dopamine MailClub", price: "mail-club" },
  "porte-cles-bestiole": { slug: "porte-cles-bestiole", name: "Porte-clés Bestiole", price: "porte-cles" },
  "porte-cles-lala": {
    slug: "blindbox-lala",
    name: "Blindbox LaLa",
    price: "blindbox-lala",
    description: "Porte-clés surprise : un modèle parmi ceux en photo.",
  },
  "porte-cles-nokio": { slug: "porte-cles-nokio", name: "Porte-clés Nokio", price: "porte-cles" },
  "print-chat-roi-1": { slug: "print-chat-roi-1", name: "Print Chat Roi 1", price: "print" },
  "print-chat-roi-2": { slug: "print-chat-roi-2", name: "Print Chat Roi 2", price: "print" },
  "print-chat-roi-3": { slug: "print-chat-roi-3", name: "Print Chat Roi 3", price: "print" },
  "print-doggo-1": { slug: "print-doggo-1", name: "Print Doggo 1", price: "print" },
  "print-doggo-2": { slug: "print-doggo-2", name: "Print Doggo 2", price: "print" },
  "print-gros-dodo": { slug: "print-gros-dodo", name: "Print Gros Dodo", price: "print" },
  "print-grozyeux-1": { slug: "print-grozyeux-1", name: "Print Grozyeux 1", price: "print" },
  "print-grozyeux-2": { slug: "print-grozyeux-2", name: "Print Grozyeux 2", price: "print" },
  "print-twilight": { slug: "print-twilight", name: "Print Twilight à l'unité", price: "print" },
  "sticker-pack-bookish": { slug: "sticker-pack-bookish", name: "Pack de stickers Bookish", price: "sticker-pack" },
  "sticker-pack-coquette": { slug: "sticker-pack-coquette", name: "Pack de stickers Coquette", price: "sticker-pack" },
  "sticker-pack-doggo": { slug: "sticker-pack-doggo", name: "Pack de stickers Doggo", price: "sticker-pack" },
  "sticker-pack-notendo": { slug: "sticker-pack-notendo", name: "Pack de stickers Notendo", price: "sticker-pack" },
  "sticker-pack-papillons": { slug: "sticker-pack-papillons", name: "Pack de stickers Papillons", price: "sticker-pack" },
  "sticker-pack-poiscailles": { slug: "sticker-pack-poiscailles", name: "Pack de stickers Poiscailles", price: "sticker-pack" },
  "sticker-pack-twilight": { slug: "sticker-pack-twilight", name: "Pack de stickers Twilight", price: "sticker-pack" },
  "sticker-pack-witchy": { slug: "sticker-pack-witchy", name: "Pack de stickers Witchy", price: "sticker-pack" },
  "sticker-chaton-mystere": {
    slug: "blindbox-chaton-mystere",
    name: "Blindbox Chaton mystère",
    price: "blindbox-chaton-mystere",
    description: "Sticker surprise : un modèle parmi ceux en photo.",
  },
  "sticker-doudou-lapin": { slug: "sticker-doudou-lapin", name: "Sticker Doudou lapin", price: "sticker" },
  "sticker-fee": { slug: "sticker-fee", name: "Sticker Fée", price: "sticker" },
  "sticker-milk": { slug: "sticker-milk", name: "Sticker Milk", price: "sticker" },
  "sticker-nokio": { slug: "sticker-nokio", name: "Sticker Nokio", price: "sticker" },
  "sticker-telephone-a-clapet": { slug: "sticker-telephone-a-clapet", name: "Sticker Téléphone à clapet", price: "sticker" },
};

/** One variant per product until Lizzie sets the variants. Stock stays unset ("Stock à valider"). */
function variant(slug: string, name: string, price: PriceKind): ProductVariant {
  return {
    id: "unique",
    sku: `DRY-${slug.toUpperCase()}`,
    name,
    attributes: [],
    priceCents: PRICE_CENTS[price],
    stockMode: "stocked",
    stock: null,
    active: true,
  };
}

function draft(g: PhotoGallery, e: Entry, variantName = "À l'unité"): Product {
  return {
    id: `real-${e.slug}`,
    slug: e.slug,
    name: e.name,
    description: e.description ?? "",
    status: "draft",
    categorySlugs: g.category ? [g.category] : [],
    collectionSlugs: [],
    images: g.images.map((img, i) => ({
      src: img.src,
      width: img.width,
      height: img.height,
      alt: `${e.name}, photo ${i + 1} sur ${g.images.length}`,
    })),
    variants: [variant(e.slug, variantName, e.price)],
    isDemo: false,
    createdAt: DATE,
    updatedAt: DATE,
  };
}

const fromGalleries = photoGalleries.map((g) => {
  const e = PRODUCTS[g.slug];
  if (!e) throw new Error(`gallery without a product entry: ${g.slug}`);
  return draft(g, e);
});

/** Complete Twilight print pack: same photos as the single print; exact content to confirm. */
const twilightGallery = photoGalleries.find((g) => g.slug === "print-twilight");
const twilightPack = twilightGallery
  ? [draft(twilightGallery, { slug: "pack-prints-twilight", name: "Pack complet de prints Twilight", price: "print-pack" }, "Pack complet")]
  : [];

export const realProducts: Product[] = [...fromGalleries, ...twilightPack];
