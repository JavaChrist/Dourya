import type { Category, CategoryIconName, ImageAsset, Product, ProductVariant, PublishStatus, StockMode } from "@/lib/types";
import { PRODUCT_ID_PATTERN } from "./admin-gate";

/**
 * Shapes of the catalogue records written by the admin, and validation of the
 * admin forms. Pure (no Firebase), unit-tested.
 */

export const CATEGORY_ICONS: readonly CategoryIconName[] = ["print", "sticker", "keychain", "headband", "sparkles"];
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_IMAGES = 24;
export const MAX_VARIANTS = 12;

/** A product image; `storagePath` is set for photos uploaded through the admin (draft photos). */
export type StoredImage = ImageAsset & { storagePath?: string };

type Data = Record<string, unknown> | undefined;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Lenient read of a stored category: null when a required field is missing. */
export function parseStoredCategory(id: string, data: Data): Category | null {
  if (!data) return null;
  const slug = str(data.slug);
  const name = str(data.name);
  const icon = str(data.icon) as CategoryIconName | undefined;
  if (!slug || !SLUG_PATTERN.test(slug) || !name || !icon || !CATEGORY_ICONS.includes(icon)) return null;
  return {
    id,
    slug,
    name,
    description: str(data.description) || undefined,
    icon,
    visible: data.visible === true,
    order: num(data.order) ?? 100,
  };
}

function parseImage(v: unknown): StoredImage | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const src = str(o.src);
  const width = num(o.width);
  const height = num(o.height);
  if (!src || !src.startsWith("/") || !width || !height) return null;
  const image: StoredImage = { src, alt: str(o.alt) ?? "", width, height };
  const storagePath = str(o.storagePath);
  if (storagePath) image.storagePath = storagePath;
  return image;
}

/** A product image path (photos are served by the site, never an outside URL). */
export const isImageSrc = (s: string) => s.startsWith("/") && !s.startsWith("//") && s.length <= 300;

/** Keeps a model photo only when it is still one of the product images (a deleted photo unlinks its model). */
export function linkVariantImages(variants: ProductVariant[], images: readonly { src: string }[]): ProductVariant[] {
  const known = new Set(images.map((i) => i.src));
  return variants.map((v) => {
    if (!v.imageSrc || known.has(v.imageSrc)) return v;
    const rest = { ...v };
    delete rest.imageSrc;
    return rest;
  });
}

function parseVariant(v: unknown): ProductVariant | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id);
  const name = str(o.name);
  const stockMode = str(o.stockMode) as StockMode | undefined;
  if (!id || !name || (stockMode !== "stocked" && stockMode !== "made_to_order")) return null;
  const priceCents = o.priceCents === null ? null : (num(o.priceCents) ?? null);
  const stock = o.stock === null || o.stock === undefined ? null : (num(o.stock) ?? null);
  const variant: ProductVariant = { id, sku: str(o.sku) ?? `DRY-${id.toUpperCase()}`, name, attributes: [], priceCents, stockMode, stock, active: o.active !== false };
  const imageSrc = str(o.imageSrc);
  if (imageSrc && isImageSrc(imageSrc)) variant.imageSrc = imageSrc;
  return variant;
}

/** Lenient read of a stored product: null when a required field is missing. */
export function parseStoredProduct(id: string, data: Data): Product | null {
  if (!data || !PRODUCT_ID_PATTERN.test(id)) return null;
  const slug = str(data.slug);
  const name = str(data.name);
  const status = str(data.status) as PublishStatus | undefined;
  if (!slug || !SLUG_PATTERN.test(slug) || !name || !status || !["draft", "published", "archived"].includes(status)) return null;
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const images = list(data.images).map(parseImage).filter((x): x is StoredImage => !!x);
  const variants = linkVariantImages(list(data.variants).map(parseVariant).filter((x): x is ProductVariant => !!x), images);
  if (variants.length === 0) return null;
  return {
    id,
    slug,
    name,
    description: str(data.description) ?? "",
    status,
    categorySlugs: list(data.categorySlugs).filter((s): s is string => typeof s === "string"),
    collectionSlugs: list(data.collectionSlugs).filter((s): s is string => typeof s === "string"),
    images,
    variants,
    isDemo: false,
    createdAt: str(data.createdAt) ?? "",
    updatedAt: str(data.updatedAt) ?? "",
  };
}

/** "bonjour Été !" -> "bonjour-ete". */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

type Fields = Record<string, string>;
export type Validation<T> = { ok: true; value: T } | { ok: false; errors: Fields };

const text = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
};

// ---- Category -------------------------------------------------------------

export type CategoryInput = { id: string | null; slug: string; name: string; description: string; icon: CategoryIconName; visible: boolean; order: number };

export function validateCategoryForm(form: FormData): Validation<CategoryInput> {
  const errors: Fields = {};
  const id = text(form, "id") || null;
  const name = text(form, "name");
  const slug = text(form, "slug") || slugify(name);
  const description = text(form, "description");
  const icon = text(form, "icon") as CategoryIconName;
  const order = Number(text(form, "order") || "100");
  if (id !== null && !/^cat-[a-z0-9-]{1,60}$/.test(id)) errors.id = "Rubrique introuvable.";
  if (name.length < 2 || name.length > 40) errors.name = "Entre 2 et 40 caractères.";
  if (!SLUG_PATTERN.test(slug) || slug.length > 60) errors.slug = "Lettres minuscules, chiffres et tirets uniquement.";
  if (description.length > 160) errors.description = "160 caractères maximum.";
  if (!CATEGORY_ICONS.includes(icon)) errors.icon = "Choisissez une icône.";
  if (!Number.isInteger(order) || order < 0 || order > 999) errors.order = "Un nombre entier entre 0 et 999.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { id, slug, name, description, icon, visible: form.get("visible") === "on", order } };
}

// ---- Product --------------------------------------------------------------

export type VariantInput = { id: string; name: string; priceCents: number | null; stockMode: StockMode; stock: number | null; active: boolean; imageSrc: string | null };
export type ProductInput = {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  status: "draft" | "archived";
  categorySlugs: string[];
  variants: VariantInput[];
};

/** "6,95" or "6.95" -> 695; "" -> null (price to set); anything else -> NaN. */
export function parseEuros(input: string): number | null {
  const v = input.replace(/\s|€/g, "").replace(",", ".");
  if (v === "") return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(v)) return Number.NaN;
  return Math.round(Number(v) * 100);
}

export function validateProductForm(form: FormData, knownCategorySlugs: ReadonlySet<string>): Validation<ProductInput> {
  const errors: Fields = {};
  const id = text(form, "id") || null;
  const name = text(form, "name");
  const slug = text(form, "slug") || slugify(name);
  const description = text(form, "description");
  const status = text(form, "status") || "draft";
  const categorySlugs = [...new Set(form.getAll("categorySlugs").filter((v): v is string => typeof v === "string"))];

  if (id !== null && !PRODUCT_ID_PATTERN.test(id)) errors.id = "Fiche introuvable.";
  if (name.length < 2 || name.length > 80) errors.name = "Entre 2 et 80 caractères.";
  if (!SLUG_PATTERN.test(slug) || slug.length > 60) errors.slug = "Lettres minuscules, chiffres et tirets uniquement.";
  if (description.length > 2000) errors.description = "2000 caractères maximum.";
  // Publishing stays closed during development: only draft or archived.
  if (status !== "draft" && status !== "archived") errors.status = "La publication n'est pas ouverte : brouillon ou archivé uniquement.";
  if (categorySlugs.length === 0) errors.categorySlugs = "Choisissez au moins une rubrique.";
  else if (categorySlugs.some((s) => !knownCategorySlugs.has(s))) errors.categorySlugs = "Rubrique inconnue.";

  const count = Math.min(Number(text(form, "variantCount") || "0"), MAX_VARIANTS);
  const variants: VariantInput[] = [];
  for (let i = 0; i < count; i++) {
    const vName = text(form, `variant.${i}.name`);
    if (!vName && !text(form, `variant.${i}.price`)) continue; // empty row
    const vId = text(form, `variant.${i}.id`) || slugify(vName) || `v${i + 1}`;
    const priceCents = parseEuros(text(form, `variant.${i}.price`));
    const stockMode = text(form, `variant.${i}.stockMode`) === "made_to_order" ? "made_to_order" : "stocked";
    const stockText = text(form, `variant.${i}.stock`);
    const stock = stockText === "" ? null : Number(stockText);
    if (vName.length < 1 || vName.length > 40) errors[`variant.${i}.name`] = "Entre 1 et 40 caractères.";
    if (priceCents !== null && (Number.isNaN(priceCents) || priceCents <= 0)) errors[`variant.${i}.price`] = "Un prix en euros, par exemple 6,95.";
    if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 9999)) errors[`variant.${i}.stock`] = "Un nombre entier entre 0 et 9999.";
    const imageSrc = text(form, `variant.${i}.image`) || null;
    if (imageSrc !== null && !isImageSrc(imageSrc)) errors[`variant.${i}.image`] = "Photo introuvable.";
    if (!/^[a-z0-9-]{1,40}$/.test(vId)) errors[`variant.${i}.name`] = "Nom d'option invalide.";
    variants.push({ imageSrc, id: vId, name: vName, priceCents: Number.isNaN(priceCents) ? null : priceCents, stockMode, stock: stockMode === "stocked" ? stock : null, active: form.get(`variant.${i}.active`) === "on" });
  }
  if (variants.length === 0) errors.variants = "Ajoutez au moins une option (par exemple « À l'unité »).";
  if (new Set(variants.map((v) => v.id)).size !== variants.length) errors.variants = "Deux options portent le même nom.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { id, slug, name, description, status: status as "draft" | "archived", categorySlugs, variants } };
}

/** Variant as stored: same shape as the fixtures (attributes empty, SKU from the slug). */
export function toVariant(slug: string, v: VariantInput): ProductVariant {
  const variant: ProductVariant = { id: v.id, sku: `DRY-${slug.toUpperCase()}-${v.id.toUpperCase()}`.slice(0, 64), name: v.name, attributes: [], priceCents: v.priceCents, stockMode: v.stockMode, stock: v.stock, active: v.active };
  if (v.imageSrc) variant.imageSrc = v.imageSrc;
  return variant;
}

// ---- Photos ---------------------------------------------------------------

/** Upload limit: under the 1 MB body limit of server actions (the browser resizes before sending). */
export const MAX_PHOTO_BYTES = 900 * 1024;

/** Real type from the first bytes (the browser-declared type is not trusted). */
export function sniffImage(bytes: Uint8Array): "webp" | "jpg" | null {
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

export function parseDimension(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 16 && n <= 4000 ? n : null;
}
