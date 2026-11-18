/**
 * Content types for the storefront.
 * Today they are filled from static files in src/data; later the same shapes
 * will come from Firebase (Firestore) through src/lib/repositories.
 */

/** A link is optional everywhere: content can exist without a destination. */
export type ContentLink = {
  href: string;
  label?: string;
};

/** Background of a section: an original DOURYA artwork or a plain colour. */
export type SectionBackground =
  | { kind: "grid" }
  | { kind: "sparkle" }
  | { kind: "solid"; color: string }
  | { kind: "none" };

export type PromoMessage = {
  id: string;
  text: string;
  link?: ContentLink;
};

export type PromoBannerConfig = {
  enabled: boolean;
  /** Seconds for one full loop of the messages. */
  durationSeconds: number;
  messages: PromoMessage[];
};

export type Slide = {
  id: string;
  title: string;
  subtitle?: string;
  /** Real image in /public. When missing, a clearly labelled demo visual is shown. */
  image?: { src: string; alt: string; width: number; height: number };
  /** Background used behind the demo visual. */
  background?: SectionBackground;
  link?: ContentLink;
  /** True for placeholder content that is not a real DOURYA creation. */
  isDemo?: boolean;
};

export type AutoCarouselConfig = {
  title?: string;
  /** Milliseconds between two slides. */
  intervalMs: number;
  slides: Slide[];
};

export type ManualCarouselConfig = {
  title: string;
  subtitle?: string;
  slides: Slide[];
  background: SectionBackground;
};

export type MailClubConfig = {
  enabled: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  cta: ContentLink & { label: string };
  image?: Slide["image"];
  background: SectionBackground;
  isDemo?: boolean;
};

/** Lucide icon names allowed for categories (mapped in components/ui/CategoryIcon). */
export type CategoryIconName = "print" | "sticker" | "keychain" | "headband" | "sparkles";

export type Category = {
  slug: string;
  name: string;
  description?: string;
  icon: CategoryIconName;
  image?: Slide["image"];
  /** Hidden categories are kept in the data but never shown. */
  visible: boolean;
  /** Ascending display order. */
  order: number;
};

export type ProductVariant = {
  id: string;
  name: string;
  /** Price in cents. null = price not set yet (never invent official prices). */
  priceCents: number | null;
  stock?: number | null;
};

export type Product = {
  slug: string;
  name: string;
  categorySlug: string;
  description: string;
  variants: ProductVariant[];
  image?: Slide["image"];
  /** Demo products are placeholders, not real DOURYA creations. */
  isDemo: boolean;
};

export type NavItem = {
  label: string;
  href: string;
};

export type SocialLink = {
  network: "instagram" | "tiktok" | "facebook" | "pinterest" | "youtube" | "other";
  label: string;
  href: string;
};

export type InfoPage = {
  slug: string;
  title: string;
};
