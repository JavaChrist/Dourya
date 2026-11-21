import { withoutDemo } from "@/lib/catalog/demo";
import type {
  AutoCarouselConfig,
  MailClubConfig,
  ManualCarouselConfig,
  PromoBannerConfig,
  SectionBackground,
} from "@/lib/types";

/**
 * Home page content. Every text, link, speed and background below is meant to
 * be edited here (later: from the admin back-office), never in components.
 * Texts marked isDemo are placeholders to replace with real content: they are
 * removed on dourya.fr (homeContent below, lib/catalog/demo.ts).
 */

export const promoBanner: PromoBannerConfig = {
  enabled: true,
  durationSeconds: 28,
  messages: [
    { id: "m1", text: "Bienvenue dans la boutique DOURYA", link: { href: "/categories/prints" } },
    { id: "m2", text: "Message promotionnel de démonstration", isDemo: true },
    { id: "m3", text: "Découvrez les stickers", link: { href: "/categories/stickers" } },
  ],
};

/** Real illustration of a product gallery (public/images/products/...). */
const photo = (path: string, alt: string, width = 780, height = 780) => ({ src: `/images/products/${path}`, alt, width, height });

export const heroCarousel: AutoCarouselConfig = {
  title: "À la une",
  intervalMs: 5000,
  slides: [
    {
      id: "hero-prints",
      title: "Prints illustrés",
      subtitle: "Les illustrations DOURYA, à accrocher chez soi.",
      image: photo("prints/print-gros-dodo/01.webp", "Print Gros Dodo : une créature rousse endormie sur un fond de feuillage vert"),
      link: { href: "/categories/prints", label: "Voir les prints" },
    },
    {
      id: "hero-stickers",
      title: "Stickers",
      subtitle: "Stickers à l'unité et packs à thème.",
      image: photo("stickers/sticker-pack-papillons/01.webp", "Pack de stickers Papillons tenu en main"),
      link: { href: "/categories/stickers", label: "Voir les stickers" },
    },
    {
      id: "hero-porte-cles",
      title: "Porte-clés",
      subtitle: "Porte-clés illustrés et blindbox.",
      image: photo("porte-cles/porte-cles-nokio/01.webp", "Porte-clés Nokio en forme de téléphone rose tenu en main"),
      link: { href: "/categories/porte-cles", label: "Voir les porte-clés" },
    },
    {
      id: "hero-headbands",
      title: "Headbands",
      subtitle: "Les headbands DOURYA.",
      image: photo("headbands/headband-1/01.webp", "Headband gris à boutons roses tenu à deux mains"),
      link: { href: "/categories/headbands", label: "Voir les headbands" },
    },
  ],
};

/**
 * Hand-picked products. A slide whose product is not on sale on this
 * deployment is left out (homeContent), so the carousel never links to a 404:
 * the others appear as soon as their product is published.
 */
export const manualCarousel: ManualCarouselConfig = {
  title: "Sélection",
  subtitle: "Les créations du moment.",
  background: { kind: "none" },
  slides: [
    { id: "sel-blindbox-lala", title: "Blindbox LaLa", image: photo("porte-cles/porte-cles-lala/01.webp", "Blindbox LaLa : planche des personnages à collectionner"), link: { href: "/produits/blindbox-lala" } },
    { id: "sel-blindbox-chaton", title: "Blindbox Chaton mystère", image: photo("stickers/sticker-chaton-mystere/01.webp", "Blindbox Chaton mystère : les sept chatons à collectionner"), link: { href: "/produits/blindbox-chaton-mystere" } },
    { id: "sel-headband-1", title: "Headband 1", image: photo("headbands/headband-1/01.webp", "Headband gris à boutons roses"), link: { href: "/produits/headband-1" } },
    { id: "sel-headband-2", title: "Headband 2", image: photo("headbands/headband-2/01.webp", "Headband blanc à boutons roses"), link: { href: "/produits/headband-2" } },
    { id: "sel-gros-dodo", title: "Print Gros Dodo", image: photo("prints/print-gros-dodo/01.webp", "Print Gros Dodo : une créature rousse endormie"), link: { href: "/produits/print-gros-dodo" } },
    { id: "sel-papillons", title: "Pack de stickers Papillons", image: photo("stickers/sticker-pack-papillons/01.webp", "Pack de stickers Papillons"), link: { href: "/produits/sticker-pack-papillons" } },
    { id: "sel-nokio", title: "Porte-clés Nokio", image: photo("porte-cles/porte-cles-nokio/01.webp", "Porte-clés Nokio en forme de téléphone rose"), link: { href: "/produits/porte-cles-nokio" } },
    { id: "sel-grozyeux-1", title: "Print Grozyeux 1", image: photo("prints/print-grozyeux-1/01.webp", "Print Grozyeux 1 : de grands yeux sur fond rose", 780, 1040), link: { href: "/produits/print-grozyeux-1" } },
    { id: "sel-milk", title: "Sticker Milk", image: photo("stickers/sticker-milk/01.webp", "Sticker Milk en forme de brique de lait rose", 775, 776), link: { href: "/produits/sticker-milk" } },
    { id: "sel-twilight", title: "Print Twilight à l'unité", image: photo("prints/print-twilight/01.webp", "Print Twilight : un motif blanc dans un cadre ovale vert"), link: { href: "/produits/print-twilight" } },
    // Demo cards: local and previews only (removed on dourya.fr).
    { id: "s1", title: "Print démo A5", link: { href: "/produits/demo-print-a5" }, isDemo: true, background: { kind: "grid" } },
    { id: "s2", title: "Sticker démo", link: { href: "/produits/demo-sticker" }, isDemo: true, background: { kind: "sparkle" } },
    { id: "s3", title: "Porte-clés démo", link: { href: "/produits/demo-porte-cles" }, isDemo: true, background: { kind: "solid", color: "var(--brand-pink-soft)" } },
  ],
};

export const mailClub: MailClubConfig = {
  enabled: true,
  eyebrow: "Mail Club",
  title: "Le Mail Club DOURYA",
  description:
    "Texte de démonstration : présentez ici le principe du Mail Club, ce que l'on reçoit et à quel rythme.",
  cta: { href: "/infos/mail-club", label: "Découvrir le Mail Club" },
  background: { kind: "sparkle" },
  isDemo: true,
};

/** Background of each home section, editable without touching components. */
export const sectionBackgrounds: Record<"categories" | "footer", SectionBackground> = {
  categories: { kind: "grid" },
  footer: { kind: "solid", color: "var(--brand-pink)" },
};

/** Slugs on sale on this deployment: a slide linking elsewhere is left out. */
export type LiveSlugs = { categories: ReadonlySet<string>; products: ReadonlySet<string> };

/** false when the slide links to a category or product not shown on this deployment. */
export function linksToLivePage(href: string | undefined, live: LiveSlugs): boolean {
  const match = href ? /^\/(categories|produits)\/([^/?#]+)$/.exec(href) : null;
  if (!match) return true;
  return (match[1] === "categories" ? live.categories : live.products).has(match[2]);
}

/**
 * Home content for this deployment: without the demo slides, messages and
 * Mail Club text when the demo is hidden (dourya.fr), and without the slides
 * that would link to a hidden category or product. A section left with
 * nothing renders nothing.
 */
export function homeContent(demoShown: boolean, live: LiveSlugs) {
  const slides = <T extends { isDemo?: boolean; link?: { href: string } }>(list: readonly T[]) =>
    withoutDemo(list, demoShown).filter((s) => linksToLivePage(s.link?.href, live));
  return {
    promoBanner: { ...promoBanner, messages: withoutDemo(promoBanner.messages, demoShown) },
    heroCarousel: { ...heroCarousel, slides: slides(heroCarousel.slides) },
    manualCarousel: { ...manualCarousel, slides: slides(manualCarousel.slides) },
    mailClub: { ...mailClub, enabled: mailClub.enabled && (demoShown || !mailClub.isDemo) },
  };
}
