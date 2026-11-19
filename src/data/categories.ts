import type { Category } from "@/lib/types";

/**
 * Shop categories. To add, hide, reorder or remove a category, edit this list
 * only: `visible` hides it, `order` sorts it. No component change needed.
 */
export const categories: Category[] = [
  {
    id: "cat-prints",
    slug: "prints",
    name: "Prints",
    description: "Illustrations imprimées",
    icon: "print",
    visible: true,
    order: 1,
  },
  {
    id: "cat-stickers",
    slug: "stickers",
    name: "Stickers",
    description: "Stickers illustrés",
    icon: "sticker",
    visible: true,
    order: 2,
  },
  {
    id: "cat-porte-cles",
    slug: "porte-cles",
    name: "Porte-clés",
    description: "Keychains illustrés",
    icon: "keychain",
    visible: true,
    order: 3,
  },
  {
    id: "cat-headbands",
    slug: "headbands",
    name: "Headbands",
    description: "Headbands illustrés",
    icon: "headband",
    visible: true,
    order: 4,
  },
];
