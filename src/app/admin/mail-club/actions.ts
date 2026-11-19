"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/app/mon-compte/actions";
import { requireAdmin } from "@/lib/auth/dal";
import { errorCode, logEvent } from "@/lib/log";
import { allowAction } from "@/lib/security/limit";
import { markDeliverySent, saveMailClubPack } from "@/lib/subscriptions/repository";

const RATE_LIMITED: FormState = { status: "error", message: "Trop d'actions d'affilée. Réessayez dans quelques minutes." };

/** Pack of the month shown on /infos/mail-club. The admin role is checked again here. */
export async function saveMailClubPackAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!(await allowAction("catalog:write", admin.uid))) return RATE_LIMITED;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const values = { title, description };
  if (!title || title.length > 120) return { status: "error", message: "Vérifiez le champ signalé.", errors: { title: "Titre obligatoire, 120 caractères au plus." }, values };
  if (description.length > 2000) return { status: "error", message: "Vérifiez le champ signalé.", errors: { description: "2 000 caractères au plus." }, values };
  try {
    await saveMailClubPack({ title, description }, admin.uid);
  } catch (error) {
    logEvent("mail_club_pack_save_error", { code: errorCode(error) });
    return { status: "error", message: "L'enregistrement n'a pas abouti.", values };
  }
  logEvent("mail_club_pack_saved");
  refresh();
  return { status: "ok", message: "Pack du mois enregistré." };
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
