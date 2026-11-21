import { heroCarousel, manualCarousel } from "@/data/home";
import type { PhotoGallery } from "@/data/product-galleries.generated";
import { isPublicPhotoUrl, toPublicPhotoUrl } from "@/lib/catalog/draft-photo-url";
import type { Product, Slide } from "@/lib/types";

/**
 * Home carousels composed in the admin (Admin → Accueil), stored in Firestore
 * `settings/home`. Pure: parsing, validation and the image choices, so it can
 * be unit-tested. When nothing is stored, the home keeps src/data/home.ts.
 *
 * - hero ("À la une", automatic): each slide links to a rubrique;
 * - selection ("Sélection", manual): each slide links to a product.
 * Order = array order. An inactive slide is kept in the admin, never shown.
 */
export type CarouselKey = "hero" | "selection";

export type HomeSlide = {
  id: string;
  title: string;
  subtitle?: string;
  /** A product photo: /images/products/** or the public route of a photo uploaded in the catalogue. */
  image: { src: string; alt: string; width: number; height: number };
  /** /categories/<slug> (hero) or /produits/<slug> (selection). */
  href: string;
  /** Button text (hero only). */
  linkLabel?: string;
  active: boolean;
};

export type HomeCarousels = { hero: HomeSlide[]; selection: HomeSlide[] };

export const HOME_LIMITS = {
  slides: { hero: 12, selection: 24 },
  title: 80,
  subtitle: 160,
  linkLabel: 40,
  alt: 200,
} as const;

export const SLIDE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SLUG = "([a-z0-9][a-z0-9-]{0,79})";
const HREF_PATTERN: Record<CarouselKey, RegExp> = {
  hero: new RegExp(`^/categories/${SLUG}$`),
  selection: new RegExp(`^/produits/${SLUG}$`),
};

/** Only product photos can be used on the home: the shop's own files or the catalogue's public photo route. */
export const isHomeImageSrc = (src: string): boolean =>
  !src.includes("..") &&
  (/^\/images\/products\/[a-z0-9/_.-]+\.(webp|jpg|jpeg|png)$/.test(src) || (isPublicPhotoUrl(src) && /^\/catalogue\/photos\/[a-z0-9-]+\/[a-z0-9]+\.(webp|jpg)$/.test(src)));

// ---- Stored document -> carousels ------------------------------------------

const str = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : undefined);
const dim = (v: unknown): number | undefined => (Number.isInteger(v) && (v as number) > 0 && (v as number) <= 10_000 ? (v as number) : undefined);

function parseSlide(raw: unknown, key: CarouselKey): HomeSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const img = (r.image ?? {}) as Record<string, unknown>;
  const id = typeof r.id === "string" && SLIDE_ID_PATTERN.test(r.id) ? r.id : undefined;
  const title = str(r.title, HOME_LIMITS.title);
  const href = typeof r.href === "string" && HREF_PATTERN[key].test(r.href) ? r.href : undefined;
  const src = typeof img.src === "string" && isHomeImageSrc(img.src) ? img.src : undefined;
  const alt = str(img.alt, HOME_LIMITS.alt);
  const width = dim(img.width);
  const height = dim(img.height);
  if (!id || !title || !href || !src || !alt || !width || !height || typeof r.active !== "boolean") return null;
  const subtitle = str(r.subtitle, HOME_LIMITS.subtitle);
  const linkLabel = key === "hero" ? str(r.linkLabel, HOME_LIMITS.linkLabel) : undefined;
  return { id, title, ...(subtitle ? { subtitle } : {}), image: { src, alt, width, height }, href, ...(linkLabel ? { linkLabel } : {}), active: r.active };
}

/**
 * Carousels of the stored document, or null when there is nothing usable
 * (then the home keeps src/data/home.ts). A malformed slide is dropped, never
 * fixed up.
 */
export function parseStoredCarousels(data: unknown): HomeCarousels | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.hero) || !Array.isArray(d.selection)) return null;
  const list = (items: unknown[], key: CarouselKey) =>
    items
      .slice(0, HOME_LIMITS.slides[key])
      .map((s) => parseSlide(s, key))
      .filter((s): s is HomeSlide => !!s);
  return { hero: list(d.hero, "hero"), selection: list(d.selection, "selection") };
}

// ---- Admin form -> carousels -----------------------------------------------

/** What the admin may pick: known images (with their real size), rubriques and products. */
export type HomeAllowed = {
  images: ReadonlyMap<string, { width: number; height: number }>;
  categorySlugs: ReadonlySet<string>;
  productSlugs: ReadonlySet<string>;
};

/** One slide as sent by the admin form (JSON). */
export type HomeSlideInput = {
  id: string;
  title: string;
  subtitle: string;
  imageSrc: string;
  alt: string;
  href: string;
  linkLabel: string;
  active: boolean;
};

export type HomeInput = { hero: HomeSlideInput[]; selection: HomeSlideInput[] };

/** Errors keyed `<carousel>` or `<slide id>.<field>`. */
export type HomeValidation = { ok: true; value: HomeCarousels } | { ok: false; errors: Record<string, string> };

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function validateHomeInput(raw: unknown, allowed: HomeAllowed): HomeValidation {
  const errors: Record<string, string> = {};
  const value: HomeCarousels = { hero: [], selection: [] };
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();

  for (const key of ["hero", "selection"] as const) {
    const list = input[key];
    if (!Array.isArray(list)) {
      errors[key] = "Données illisibles : rechargez la page.";
      continue;
    }
    if (list.length > HOME_LIMITS.slides[key]) {
      errors[key] = `${HOME_LIMITS.slides[key]} diapos au maximum.`;
      continue;
    }
    for (const item of list) {
      const s = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const id = text(s.id);
      if (!SLIDE_ID_PATTERN.test(id) || seen.has(id)) {
        errors[key] = "Une diapo est illisible : rechargez la page.";
        continue;
      }
      seen.add(id);
      const err = (field: string, message: string) => (errors[`${id}.${field}`] = message);

      const title = text(s.title);
      if (!title) err("title", "Le titre est obligatoire.");
      else if (title.length > HOME_LIMITS.title) err("title", `${HOME_LIMITS.title} caractères au maximum.`);

      const subtitle = text(s.subtitle);
      if (subtitle.length > HOME_LIMITS.subtitle) err("subtitle", `${HOME_LIMITS.subtitle} caractères au maximum.`);

      const linkLabel = key === "hero" ? text(s.linkLabel) : "";
      if (linkLabel.length > HOME_LIMITS.linkLabel) err("linkLabel", `${HOME_LIMITS.linkLabel} caractères au maximum.`);

      const src = text(s.imageSrc);
      const size = allowed.images.get(src);
      if (!src) err("image", "Choisissez une photo.");
      else if (!size || !isHomeImageSrc(src)) err("image", "Cette photo n'existe plus : choisissez-en une autre.");

      const alt = text(s.alt);
      if (!alt) err("alt", "Décrivez la photo (lu par les lecteurs d'écran).");
      else if (alt.length > HOME_LIMITS.alt) err("alt", `${HOME_LIMITS.alt} caractères au maximum.`);

      const href = text(s.href);
      const match = HREF_PATTERN[key].exec(href);
      const known = key === "hero" ? allowed.categorySlugs : allowed.productSlugs;
      if (!href) err("href", key === "hero" ? "Choisissez une rubrique." : "Choisissez un produit.");
      else if (!match || !known.has(match[1])) err("href", key === "hero" ? "Cette rubrique n'existe pas." : "Ce produit n'existe pas.");

      if (typeof s.active !== "boolean") err("active", "Valeur illisible.");

      if (Object.keys(errors).some((k) => k.startsWith(`${id}.`))) continue;
      value[key].push({
        id,
        title,
        ...(subtitle ? { subtitle } : {}),
        image: { src, alt, width: size!.width, height: size!.height },
        href,
        ...(linkLabel ? { linkLabel } : {}),
        active: s.active as boolean,
      });
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

// ---- Images and defaults ---------------------------------------------------

/** A photo the admin can pick: `src` is stored (public URL), `preview` is shown in the admin. */
export type ImageChoice = { src: string; preview: string; width: number; height: number; alt: string; group: string };

/**
 * Every product photo: the images of the (non-demo) products, then the photo
 * galleries of public/images/products not used by a product. Uploaded photos
 * are stored with their public URL, shown on the home only while the product
 * is listed (homeContent).
 */
export function imageChoices(products: readonly Product[], galleries: readonly PhotoGallery[]): ImageChoice[] {
  const out = new Map<string, ImageChoice>();
  for (const p of products) {
    if (p.isDemo) continue;
    for (const i of p.images) {
      const src = toPublicPhotoUrl(i.src);
      if (!out.has(src)) out.set(src, { src, preview: i.src, width: i.width, height: i.height, alt: i.alt || p.name, group: p.name });
    }
  }
  for (const g of galleries) {
    for (const i of g.images) {
      if (!out.has(i.src)) out.set(i.src, { src: i.src, preview: i.src, width: i.width, height: i.height, alt: "", group: g.folder });
    }
  }
  return [...out.values()].filter((c) => isHomeImageSrc(c.src));
}

const fromCode = (slide: Slide, key: CarouselKey): HomeSlide | null =>
  slide.isDemo || !slide.image || !slide.link
    ? null
    : {
        id: slide.id,
        title: slide.title,
        ...(slide.subtitle ? { subtitle: slide.subtitle } : {}),
        image: { ...slide.image },
        href: slide.link.href,
        ...(key === "hero" && slide.link.label ? { linkLabel: slide.link.label } : {}),
        active: true,
      };

/** The carousels written in src/data/home.ts, without the demo slides: the starting point of the admin. */
export function codeCarousels(): HomeCarousels {
  const list = (slides: Slide[], key: CarouselKey) => slides.map((s) => fromCode(s, key)).filter((s): s is HomeSlide => !!s);
  return { hero: list(heroCarousel.slides, "hero"), selection: list(manualCarousel.slides, "selection") };
}

/** Active slides, in order, in the shape of the home components. */
export function toSlides(slides: readonly HomeSlide[]): Slide[] {
  return slides
    .filter((s) => s.active)
    .map((s) => ({
      id: s.id,
      title: s.title,
      ...(s.subtitle ? { subtitle: s.subtitle } : {}),
      image: { ...s.image },
      link: { href: s.href, ...(s.linkLabel ? { label: s.linkLabel } : {}) },
    }));
}
