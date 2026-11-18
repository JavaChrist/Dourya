import type { Collection } from "@/lib/types";

/**
 * DEMO COLLECTIONS. Cross-category groupings (seasons, new arrivals...).
 * Replace with the real ones (later: Firestore). `visible` hides, `order` sorts.
 */
export const collections: Collection[] = [
  {
    id: "col-nouveautes",
    slug: "nouveautes",
    name: "Nouveautés",
    description: "Les dernières créations ajoutées à la boutique.",
    visible: true,
    order: 1,
    isDemo: true,
  },
  {
    id: "col-saison-demo",
    slug: "saison-demo",
    name: "Collection saisonnière démo",
    description: "Exemple de collection saisonnière, pour tester les regroupements.",
    visible: true,
    order: 2,
    isDemo: true,
  },
  {
    id: "col-masquee-demo",
    slug: "masquee-demo",
    name: "Collection masquée démo",
    visible: false,
    order: 3,
    isDemo: true,
  },
];
