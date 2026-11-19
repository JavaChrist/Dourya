import type { Category, InfoPage, NavItem, SocialLink } from "@/lib/types";

/** Production domain. www.dourya.fr, dourya.shop and www.dourya.shop redirect here (308, Vercel). */
export const PRODUCTION_SITE_URL = "https://dourya.fr";

/**
 * Origin read from NEXT_PUBLIC_SITE_URL (inlined at build time, safe in the browser).
 * Only http(s) is accepted; any path is dropped. Undefined when unset or invalid.
 */
export function parseSiteUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

function isLocalOrigin(origin: string): boolean {
  const host = new URL(origin).hostname;
  return LOCAL_HOSTS.has(host) || host.endsWith(".localhost");
}

/**
 * Like parseSiteUrl, but a production build ignores a local origin: a
 * localhost value copied from a dev env must never reach e-mails, robots.txt
 * or canonical URLs. The caller then falls back to the production domain.
 */
export function resolveSiteUrl(raw: string | undefined, production: boolean): string | undefined {
  const origin = parseSiteUrl(raw);
  if (origin && production && isLocalOrigin(origin)) return undefined;
  return origin;
}

export function configuredSiteUrl(): string | undefined {
  return resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV === "production");
}

/**
 * Public origin of the site, for metadataBase, canonical URLs, robots.txt and
 * sitemap.xml. Falls back to the production domain in a production build, to
 * localhost in development.
 */
export function siteOrigin(): string {
  return configuredSiteUrl() ?? (process.env.NODE_ENV === "production" ? PRODUCTION_SITE_URL : "http://localhost:3000");
}

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

/**
 * Rubriques shown in the desktop header: none. The header keeps « Boutique »
 * and « Mail Club »; every rubrique is in the menu (hamburger) and the footer.
 */
export const HEADER_CATEGORY_LIMIT = 0;

/**
 * Main navigation: "Boutique", then the visible rubriques (already sorted by
 * display order, e.g. getVisibleCategories()), then "Mail Club". `limit` caps
 * the number of rubriques (desktop header); a hidden rubrique is never listed.
 */
export function buildNav(categories: Category[], limit = Infinity): NavItem[] {
  const rubriques = categories.filter((c) => c.visible).slice(0, limit);
  return [
    { label: "Boutique", href: "/boutique" },
    ...rubriques.map((c) => ({ label: c.name, href: `/categories/${c.slug}` })),
    { label: "Mail Club", href: "/infos/mail-club" },
  ];
}

/** Copyright holder shown in the footer. */
export const copyrightHolder = "JavaChrist";

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
