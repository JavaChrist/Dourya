import type { InfoPage, NavItem, SocialLink } from "@/lib/types";

/**
 * Site-wide settings. Contact details, social links and legal information are
 * left empty on purpose: they must come from DOURYA, never be invented.
 */
export const site = {
  name: "DOURYA",
  description: "Illustrations et créations originales : prints, stickers et porte-clés.",
  locale: "fr-FR",
  /** Fill when known, e.g. "bonjour@exemple.fr". Empty = shown as "à compléter". */
  contactEmail: "",
};

export const mainNav: NavItem[] = [
  { label: "Boutique", href: "/boutique" },
  { label: "Prints", href: "/categories/prints" },
  { label: "Stickers", href: "/categories/stickers" },
  { label: "Porte-clés", href: "/categories/porte-cles" },
  { label: "Mail Club", href: "/infos/mail-club" },
];

/** Empty until DOURYA provides the real accounts. */
export const socialLinks: SocialLink[] = [];

export const infoPages: InfoPage[] = [
  { slug: "contact", title: "Contact" },
  { slug: "mail-club", title: "Mail Club" },
  { slug: "mentions-legales", title: "Mentions légales" },
  { slug: "cgv", title: "Conditions générales de vente" },
  { slug: "confidentialite", title: "Politique de confidentialité" },
  { slug: "livraison-retours", title: "Livraison et retours" },
];

export const footerLegal: NavItem[] = [
  { label: "Mentions légales", href: "/infos/mentions-legales" },
  { label: "CGV", href: "/infos/cgv" },
  { label: "Confidentialité", href: "/infos/confidentialite" },
  { label: "Livraison et retours", href: "/infos/livraison-retours" },
];
