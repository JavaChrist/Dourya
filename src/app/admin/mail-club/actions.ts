"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/mon-compte/actions";
import { requireAdmin } from "@/lib/auth/dal";
import { catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { CatalogRefusal } from "@/lib/catalog/admin-repository";
import { MAX_PHOTO_BYTES, parseDimension, sniffImage } from "@/lib/catalog/stored-schema";
import { errorCode, logEvent } from "@/lib/log";
import { allowAction } from "@/lib/security/limit";
import { markDeliverySent } from "@/lib/subscriptions/repository";
import { PACK_ID_PATTERN, PACK_TITLE_MAX, validatePackText } from "@/lib/subscriptions/packs";
import { addPackPhoto, createPack, editPackPhoto, savePackText, setPackStatus, type PackPhotoEdit } from "@/lib/subscriptions/packs-repository";

/**
 * Mail Club admin actions. Each one checks the admin role again (not only on
 * the page), the rate limit, and that the photo storage is open here.
 */
const RATE_LIMITED: FormState = { status: "error", message: "Trop d'actions d'affilée. Réessayez dans quelques minutes." };
const CLOSED: FormState = { status: "error", message: "L'administration du Mail Club n'est pas ouverte ici. Rien n'a été enregistré." };
const FAILED: FormState = { status: "error", message: "L'enregistrement n'a pas abouti. Réessayez plus tard." };

async function guard(): Promise<{ uid: string } | FormState> {
  const admin = await requireAdmin();
  if (!catalogAdminEnabled(process.env)) return CLOSED;
  if (!(await allowAction("catalog:write", admin.uid))) return RATE_LIMITED;
  return { uid: admin.uid };
}

const refused = (g: { uid: string } | FormState): g is FormState => "status" in g;

function failure(event: string, error: unknown): FormState {
  if (error instanceof CatalogRefusal) return { status: "error", message: error.message };
  logEvent(event, { code: errorCode(error) });
  return FAILED;
}

const packId = (form: FormData): string | null => {
  const id = form.get("productId") ?? form.get("packId");
  return typeof id === "string" && PACK_ID_PATTERN.test(id) ? id : null;
};

/** New monthly fiche (draft), then its page to add photos and text. */
export async function createPackAction(_prev: FormState, form: FormData): Promise<FormState> {
  const g = await guard();
  if (refused(g)) return g;
  const month = String(form.get("month") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const values = { month, title };
  const errors: Record<string, string> = {};
  if (!PACK_ID_PATTERN.test(month)) errors.month = "Choisissez le mois du pack.";
  if (!title || title.length > PACK_TITLE_MAX) errors.title = `Titre obligatoire, ${PACK_TITLE_MAX} caractères au plus.`;
  if (Object.keys(errors).length) return { status: "error", message: "Vérifiez les champs signalés.", errors, values };
  try {
    await createPack(month, title, g.uid, new Date());
  } catch (error) {
    return { ...failure("mail_club_pack_error", error), values };
  }
  logEvent("mail_club_pack_created");
  redirect(`/admin/mail-club/packs/${month}?cree=1`);
}

export async function savePackTextAction(_prev: FormState, form: FormData): Promise<FormState> {
  const g = await guard();
  if (refused(g)) return g;
  const id = packId(form);
  if (!id) return { status: "error", message: "Fiche introuvable." };
  const parsed = validatePackText(form);
  const values = { title: String(form.get("title") ?? ""), description: String(form.get("description") ?? "") };
  if (!parsed.ok) return { status: "error", message: "Vérifiez les champs signalés.", errors: parsed.errors, values };
  let unpublished: boolean;
  try {
    unpublished = await savePackText(id, parsed.value, g.uid);
  } catch (error) {
    return { ...failure("mail_club_pack_error", error), values };
  }
  logEvent("mail_club_pack_saved", { unpublished });
  refresh();
  return unpublished
    ? { status: "ok", message: "Fiche enregistrée, mais elle n'est plus complète : elle repasse en brouillon et quitte la page Mail Club." }
    : { status: "ok", message: "Fiche enregistrée." };
}

export async function setPackStatusAction(_prev: FormState, form: FormData): Promise<FormState> {
  const g = await guard();
  if (refused(g)) return g;
  const id = packId(form);
  const status = form.get("status");
  if (!id || (status !== "published" && status !== "draft")) return { status: "error", message: "Action invalide." };
  try {
    await setPackStatus(id, status, g.uid, new Date());
  } catch (error) {
    return failure("mail_club_pack_error", error);
  }
  logEvent("mail_club_pack_status", { status });
  refresh();
  return {
    status: "ok",
    message: status === "published" ? "Pack publié : il est visible sur la page Mail Club." : "Pack repassé en brouillon : il a quitté la page Mail Club.",
  };
}

/** One photo per call (the browser sends the photos one by one, already resized). */
export async function uploadPackPhotoAction(form: FormData): Promise<FormState> {
  const g = await guard();
  if (refused(g)) return g;
  const id = packId(form);
  const photo = form.get("photo");
  const width = parseDimension(String(form.get("width") ?? ""));
  const height = parseDimension(String(form.get("height") ?? ""));
  const alt = String(form.get("alt") ?? "").trim().slice(0, 160);
  if (!id) return { status: "error", message: "Fiche introuvable." };
  if (!(photo instanceof File) || photo.size === 0) return { status: "error", message: "Aucune photo reçue." };
  if (photo.size > MAX_PHOTO_BYTES) return { status: "error", message: "Photo trop lourde, même après réduction." };
  if (!width || !height) return { status: "error", message: "Dimensions de la photo invalides." };
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { status: "error", message: "Format non reconnu (WebP ou JPEG attendu)." };
  try {
    await addPackPhoto(id, kind, bytes, { width, height }, alt, g.uid);
  } catch (error) {
    return failure("mail_club_photo_error", error);
  }
  logEvent("mail_club_photo_added", { kind, kb: Math.round(bytes.length / 1024) });
  refresh();
  return { status: "ok", message: "Photo ajoutée." };
}

const OPS = new Set(["up", "down", "cover", "delete", "alt"]);

export async function editPackPhotoAction(_prev: FormState, form: FormData): Promise<FormState> {
  const g = await guard();
  if (refused(g)) return g;
  const id = packId(form);
  const src = form.get("src");
  const op = form.get("op");
  if (!id || typeof src !== "string" || src.length > 300 || typeof op !== "string" || !OPS.has(op)) return { status: "error", message: "Action invalide." };
  const edit: PackPhotoEdit = op === "alt" ? { op, alt: String(form.get("alt") ?? "").trim().slice(0, 160) } : { op: op as "up" | "down" | "cover" | "delete" };
  let unpublished: boolean;
  try {
    unpublished = await editPackPhoto(id, src, edit, g.uid);
  } catch (error) {
    return failure("mail_club_photo_error", error);
  }
  logEvent("mail_club_photo_edited", { op, unpublished });
  refresh();
  if (unpublished) return { status: "ok", message: "Photos mises à jour. Le pack n'est plus complet : il repasse en brouillon." };
  return { status: "ok", message: op === "delete" ? "Photo retirée." : "Photos mises à jour." };
}

/** One paid pack has been posted. */
export async function markDeliverySentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!(await allowAction("catalog:write", admin.uid))) return RATE_LIMITED;
  const id = formData.get("id");
  if (typeof id !== "string" || !/^in_[A-Za-z0-9]{1,100}$/.test(id)) return { status: "error", message: "Envoi introuvable." };
  try {
    if (!(await markDeliverySent(id, admin.uid, new Date()))) return { status: "error", message: "Envoi introuvable ou déjà marqué." };
  } catch (error) {
    logEvent("mail_club_delivery_error", { code: errorCode(error) });
    return { status: "error", message: "L'enregistrement n'a pas abouti." };
  }
  logEvent("mail_club_delivery_sent");
  refresh();
  return { status: "ok", message: "Pack marqué comme envoyé." };
}
