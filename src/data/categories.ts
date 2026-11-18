import type { Category } from "@/lib/types";

/**
 * Shop categories. To add, hide, reorder or remove a category, edit this list
 * only: `visible` hides it, `order` sorts it. No component change needed.
 */
export const categories: Category[] = [
  {
    slug: "prints",
    name: "Prints",
    description: "Illustrations imprimées",
    icon: "print",
    visible: true,
    order: 1,
  },
  {
    slug: "stickers",
    name: "Stickers",
    description: "Stickers illustrés",
    icon: "sticker",
    visible: true,
    order: 2,
  },
  {
    slug: "porte-cles",
    name: "Porte-clés",
    description: "Keychains illustrés",
    icon: "keychain",
    visible: true,
    order: 3,
  },
  {
    // To confirm before activation (see README).
    slug: "headbands",
    name: "Headbands",
    description: "Catégorie à confirmer",
    icon: "headband",
    visible: false,
    order: 4,
  },
];
