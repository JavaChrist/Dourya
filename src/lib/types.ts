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

export type ImageAsset = { src: string; alt: string; width: number; height: number };

export type SeoFields = { title?: string; description?: string };

export type Category = {
  id: string;
  /** Stable URL key: never change it once published. */
  slug: string;
  name: string;
  description?: string;
  icon: CategoryIconName;
  image?: ImageAsset;
  /** Hidden categories are kept in the data but never shown. */
  visible: boolean;
  /** Ascending display order. */
  order: number;
  seo?: SeoFields;
};

/** Cross-category grouping: seasons, new arrivals, selections... */
export type Collection = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image?: ImageAsset;
  visible: boolean;
  order: number;
  seo?: SeoFields;
  isDemo?: boolean;
};

export type PublishStatus = "draft" | "published" | "archived";

/** "made_to_order": produced after the order, no stock count. "stocked": limited by `stock`. */
export type StockMode = "made_to_order" | "stocked";

/** Free attributes: each product defines its own (format, finish, model...). */
export type VariantAttribute = { name: string; value: string };

export type ProductVariant = {
  id: string;
  sku: string;
  /** Short label shown to the customer, e.g. "A4 · Mat". */
  name: string;
  attributes: VariantAttribute[];
  /** Price in cents EUR, as displayed. null = price not set yet: cannot be added to the cart. */
  priceCents: number | null;
  /** Packed weight and dimensions, used for shipping in Lot 4. */
  weightGrams?: number;
  packedDimensionsMm?: { length: number; width: number; height: number };
  stockMode: StockMode;
  /** Units in stock (stocked mode only). */
  stock?: number | null;
  /** Low-stock alert threshold (stocked mode only). */
  lowStockThreshold?: number;
  /** Manual switch to hide a variant without deleting it. */
  active: boolean;
};

/**
 * Optional personalisation, disabled by default. It can be limited to some
 * variants and to a time window, with an optional quota.
 */
export type PersonalisationConfig = {
  enabled: boolean;
  label: string;
  maxLength: number;
  surchargeCents: number;
  instructions?: string;
  /** Restrict to these variants. Empty or missing = all variants. */
  variantIds?: string[];
  /** ISO dates. Missing = no limit on that side. */
  availableFrom?: string;
  availableUntil?: string;
  /** Max number of personalised units, null = unlimited. */
  quota?: number | null;
  /** Units already used (filled by orders in Lot 4). */
  quotaUsed?: number;
};

export type Product = {
  id: string;
  /** Unique, stable URL key. */
  slug: string;
  name: string;
  description: string;
  status: PublishStatus;
  categorySlugs: string[];
  collectionSlugs: string[];
  /** Ordered images, first = main image. */
  images: ImageAsset[];
  /** Demo only: placeholder visuals shown when no real image exists. */
  demoVisuals?: SectionBackground[];
  variants: ProductVariant[];
  personalisation?: PersonalisationConfig;
  /** Max quantity of one line in the cart. Default: commerceConfig.maxQuantityPerLine. */
  maxQuantityPerLine?: number;
  /** Demo products are placeholders, not real DOURYA creations: never purchasable. */
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  seo?: SeoFields;
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
