import type { Product } from "@/lib/types";

/**
 * DEMO PRODUCTS ONLY.
 * These are placeholders to test the interface. They are not real DOURYA
 * creations and have no official price (priceCents: null).
 * Replace this file with real data (later: Firestore).
 */
export const products: Product[] = [
  {
    slug: "demo-print-a5",
    name: "Print démo A5",
    categorySlug: "prints",
    description: "Produit de démonstration pour tester la fiche print.",
    variants: [
      { id: "a5", name: "A5", priceCents: null },
      { id: "a4", name: "A4", priceCents: null },
    ],
    isDemo: true,
  },
  {
    slug: "demo-print-a4",
    name: "Print démo A4",
    categorySlug: "prints",
    description: "Produit de démonstration pour tester la fiche print.",
    variants: [{ id: "a4", name: "A4", priceCents: null }],
    isDemo: true,
  },
  {
    slug: "demo-sticker",
    name: "Sticker démo",
    categorySlug: "stickers",
    description: "Produit de démonstration pour tester la fiche sticker.",
    variants: [{ id: "unit", name: "À l'unité", priceCents: null }],
    isDemo: true,
  },
  {
    slug: "demo-planche-stickers",
    name: "Planche de stickers démo",
    categorySlug: "stickers",
    description: "Produit de démonstration pour tester une planche de stickers.",
    variants: [{ id: "sheet", name: "Planche", priceCents: null }],
    isDemo: true,
  },
  {
    slug: "demo-porte-cles",
    name: "Porte-clés démo",
    categorySlug: "porte-cles",
    description: "Produit de démonstration pour tester la fiche porte-clés.",
    variants: [{ id: "unit", name: "À l'unité", priceCents: null }],
    isDemo: true,
  },
];
