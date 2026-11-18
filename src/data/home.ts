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
 * Texts marked isDemo are placeholders to replace with real content.
 */

export const promoBanner: PromoBannerConfig = {
  enabled: true,
  durationSeconds: 28,
  messages: [
    { id: "m1", text: "Bienvenue dans la boutique DOURYA", link: { href: "/categorie/prints" } },
    { id: "m2", text: "Message promotionnel de démonstration" },
    { id: "m3", text: "Découvrez les stickers", link: { href: "/categorie/stickers" } },
  ],
};

export const heroCarousel: AutoCarouselConfig = {
  title: "À la une",
  intervalMs: 5000,
  slides: [
    {
      id: "hero-1",
      title: "Prints illustrés",
      subtitle: "Visuel de démonstration : remplacez-le par une vraie photo.",
      background: { kind: "sparkle" },
      link: { href: "/categorie/prints", label: "Voir les prints" },
      isDemo: true,
    },
    {
      id: "hero-2",
      title: "Stickers",
      subtitle: "Visuel de démonstration : remplacez-le par une vraie photo.",
      background: { kind: "grid" },
      link: { href: "/categorie/stickers", label: "Voir les stickers" },
      isDemo: true,
    },
    {
      id: "hero-3",
      title: "Porte-clés",
      subtitle: "Visuel de démonstration : remplacez-le par une vraie photo.",
      background: { kind: "solid", color: "var(--brand-pink-soft)" },
      link: { href: "/categorie/porte-cles", label: "Voir les porte-clés" },
      isDemo: true,
    },
  ],
};

export const manualCarousel: ManualCarouselConfig = {
  title: "Sélection",
  subtitle: "Produits de démonstration, en attendant les vraies créations.",
  background: { kind: "none" },
  slides: [
    { id: "s1", title: "Print démo A5", link: { href: "/produit/demo-print-a5" }, isDemo: true, background: { kind: "grid" } },
    { id: "s2", title: "Sticker démo", link: { href: "/produit/demo-sticker" }, isDemo: true, background: { kind: "sparkle" } },
    { id: "s3", title: "Porte-clés démo", link: { href: "/produit/demo-porte-cles" }, isDemo: true, background: { kind: "solid", color: "var(--brand-pink-soft)" } },
    { id: "s4", title: "Print démo A4", link: { href: "/produit/demo-print-a4" }, isDemo: true, background: { kind: "grid" } },
    { id: "s5", title: "Planche de stickers démo", link: { href: "/produit/demo-planche-stickers" }, isDemo: true, background: { kind: "sparkle" } },
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
