"use server";

import { updateTag, refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/mon-compte/actions";
import { requireAdmin } from "@/lib/auth/dal";
import { PRODUCT_ID_PATTERN, catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { CatalogRefusal, adminCatalog, addPhoto, editPhoto, saveCategory, saveProduct, setProductStatus, type PhotoEdit } from "@/lib/catalog/admin-repository";
import { MAX_PHOTO_BYTES, parseDimension, sniffImage, validateCategoryForm, validateProductForm } from "@/lib/catalog/stored-schema";
import { errorCode, logEvent } from "@/lib/log";
import { allowAction } from "@/lib/security/limit";

/**
 * Catalogue admin actions. Each one: admin role (again, not only on the page),
 * catalogue admin open here (dourya.fr in mode "production", or the
 * stripe-test preview + dourya-test, see admin-gate.ts), rate limit,
 * validation, write, then the "catalog" cache tag is expired: the shop shows
 * the new visible rubriques and the published products that are ready
 * (merge.ts); drafts and archived products stay private. Payment stays closed.
 */
const CLOSED: FormState = { status: "error", message: "L'administration du catalogue n'est pas ouverte ici. Rien n'a été enregistré." };
const RATE_LIMITED: FormState = { status: "error", message: "Trop de modifications d'affilée. Réessayez dans quelques minutes." };
const FAILED: FormState = { status: "error", message: "L'enregistrement n'a pas abouti. Réessayez plus tard." };

async function guard(): Promise<FormState | null> {
  const admin = await requireAdmin();
  if (!catalogAdminEnabled(process.env)) return CLOSED;
  if (!(await allowAction("catalog:write", admin.uid))) return RATE_LIMITED;
  return null;
}

function failure(event: string, error: unknown): FormState {
  if (error instanceof CatalogRefusal) return { status: "error", message: error.message };
  logEvent(event, { code: errorCode(error) });
  return FAILED;
}

function done() {
  updateTag("catalog");
  refresh();
}

function echo(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== "string" || k.startsWith("$")) continue;
    values[k] = k in values ? `${values[k]},${v.slice(0, 200)}` : v.slice(0, 2000);
  }
  return values;
}

export async function saveCategoryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const refused = await guard();
  if (refused) return refused;
  const parsed = validateCategoryForm(form);
  if (!parsed.ok) return { status: "error", message: "Vérifiez les champs signalés.", errors: parsed.errors, values: echo(form) };
  try {
    const category = await saveCategory(parsed.value);
    logEvent("catalog_category_saved", { id: category.id });
  } catch (error) {
    return { ...failure("catalog_category_error", error), values: echo(form) };
  }
  done();
  return { status: "ok", message: parsed.value.id ? "Rubrique enregistrée." : "Rubrique créée." };
}

export async function saveProductAction(_prev: FormState, form: FormData): Promise<FormState> {
  const refused = await guard();
  if (refused) return refused;
  let id: string;
  try {
    const { categories } = await adminCatalog();
    const parsed = validateProductForm(form, new Set(categories.map((c) => c.slug)));
    if (!parsed.ok) return { status: "error", message: "Vérifiez les champs signalés.", errors: parsed.errors, values: echo(form) };
    const { product, unpublished } = await saveProduct(parsed.value);
    id = product.id;
    logEvent("catalog_product_saved", { id, unpublished });
    if (parsed.value.id) {
      done();
      return unpublished
        ? { status: "ok", message: "Fiche enregistrée, mais elle n'est plus complète : elle repasse en brouillon et quitte la boutique. Voir « Publication »." }
        : { status: "ok", message: "Fiche enregistrée." };
    }
  } catch (error) {
    return { ...failure("catalog_product_error", error), values: echo(form) };
  }
  done();
  redirect(`/admin/catalogue/produits/${id}?cree=1`);
}

/** One photo per call (the browser sends the selected photos one by one, already resized). */
export async function uploadPhotoAction(form: FormData): Promise<FormState> {
  const refused = await guard();
  if (refused) return refused;
  const productId = form.get("productId");
  const photo = form.get("photo");
  const width = parseDimension(String(form.get("width") ?? ""));
  const height = parseDimension(String(form.get("height") ?? ""));
  const alt = String(form.get("alt") ?? "").trim().slice(0, 160);
  if (typeof productId !== "string" || !PRODUCT_ID_PATTERN.test(productId)) return { status: "error", message: "Fiche introuvable." };
  if (!(photo instanceof File) || photo.size === 0) return { status: "error", message: "Aucune photo reçue." };
  if (photo.size > MAX_PHOTO_BYTES) return { status: "error", message: "Photo trop lourde, même après réduction." };
  if (!width || !height) return { status: "error", message: "Dimensions de la photo invalides." };
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { status: "error", message: "Format non reconnu (WebP ou JPEG attendu)." };
  try {
    await addPhoto(productId, kind, bytes, { width, height }, alt);
    logEvent("catalog_photo_added", { id: productId, kind, kb: Math.round(bytes.length / 1024) });
  } catch (error) {
    return failure("catalog_photo_error", error);
  }
  done();
  return { status: "ok", message: "Photo ajoutée." };
}

const OPS = new Set(["up", "down", "cover", "delete", "alt"]);

export async function editPhotoAction(_prev: FormState, form: FormData): Promise<FormState> {
  const refused = await guard();
  if (refused) return refused;
  const productId = form.get("productId");
  const src = form.get("src");
  const op = form.get("op");
  if (typeof productId !== "string" || !PRODUCT_ID_PATTERN.test(productId) || typeof src !== "string" || src.length > 300 || typeof op !== "string" || !OPS.has(op))
    return { status: "error", message: "Action invalide." };
  const edit: PhotoEdit = op === "alt" ? { op, alt: String(form.get("alt") ?? "").trim().slice(0, 160) } : { op: op as "up" | "down" | "cover" | "delete" };
  try {
    await editPhoto(productId, src, edit);
    logEvent("catalog_photo_edited", { id: productId, op });
  } catch (error) {
    return failure("catalog_photo_error", error);
  }
  done();
  return { status: "ok", message: op === "delete" ? "Photo retirée." : "Photos mises à jour." };
}

const STATUS_DONE = { published: "Fiche publiée : elle est visible dans la boutique (la vente reste fermée).", draft: "Fiche repassée en brouillon : elle a quitté la boutique.", archived: "Fiche archivée : elle a quitté la boutique." } as const;

/** « Publier » (readiness checked again on the server), « Repasser en brouillon », « Archiver ». */
export async function setProductStatusAction(_prev: FormState, form: FormData): Promise<FormState> {
  const refused = await guard();
  if (refused) return refused;
  const productId = form.get("productId");
  const status = form.get("status");
  if (typeof productId !== "string" || !PRODUCT_ID_PATTERN.test(productId) || (status !== "published" && status !== "draft" && status !== "archived"))
    return { status: "error", message: "Action invalide." };
  try {
    await setProductStatus(productId, status);
    logEvent("catalog_product_status", { id: productId, status });
  } catch (error) {
    return failure("catalog_product_status_error", error);
  }
  done();
  return { status: "ok", message: STATUS_DONE[status] };
}
