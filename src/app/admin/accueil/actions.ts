"use server";

import { refresh, updateTag } from "next/cache";
import type { FormState } from "@/app/mon-compte/actions";
import { requireAdmin } from "@/lib/auth/dal";
import { catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { allowedFrom, homeAdminOptions } from "@/lib/home/admin-options";
import { validateHomeInput } from "@/lib/home/carousels";
import { HOME_TAG, resetHomeCarousels, saveHomeCarousels } from "@/lib/home/repository";
import { errorCode, logEvent } from "@/lib/log";
import { allowAction } from "@/lib/security/limit";

/**
 * Admin → Accueil: the slides of the two home carousels. Admin role (again,
 * not only on the page), admin open here (same gate as the catalogue), rate
 * limit, validation against a fresh read of the catalogue (known photos,
 * rubriques and products only), then settings/home is replaced and the
 * "home" cache tag expired.
 */
const CLOSED: FormState = { status: "error", message: "L'administration n'est pas ouverte ici. Rien n'a été enregistré." };
const RATE_LIMITED: FormState = { status: "error", message: "Trop de modifications d'affilée. Réessayez dans quelques minutes." };
const FAILED: FormState = { status: "error", message: "L'enregistrement n'a pas abouti. Réessayez plus tard." };
const MAX_PAYLOAD = 200_000;

async function guard(): Promise<{ uid: string } | FormState> {
  const admin = await requireAdmin();
  if (!catalogAdminEnabled(process.env)) return CLOSED;
  if (!(await allowAction("catalog:write", admin.uid))) return RATE_LIMITED;
  return { uid: admin.uid };
}

function done() {
  updateTag(HOME_TAG);
  refresh();
}

export async function saveHomeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const g = await guard();
  if ("status" in g) return g;
  const payload = form.get("payload");
  let raw: unknown;
  try {
    if (typeof payload !== "string" || payload.length > MAX_PAYLOAD) throw new Error("payload");
    raw = JSON.parse(payload);
  } catch {
    return { status: "error", message: "Le formulaire est illisible : rechargez la page. Rien n'a été enregistré." };
  }
  try {
    const parsed = validateHomeInput(raw, allowedFrom(await homeAdminOptions()));
    if (!parsed.ok) return { status: "error", message: "Vérifiez les champs signalés. Rien n'a été enregistré.", errors: parsed.errors };
    await saveHomeCarousels(parsed.value, g.uid);
    logEvent("home_carousels_saved", { hero: parsed.value.hero.length, selection: parsed.value.selection.length });
  } catch (error) {
    logEvent("home_carousels_save_failed", { code: errorCode(error) });
    return FAILED;
  }
  done();
  return { status: "ok", message: "Accueil enregistré. Les diapos actives apparaissent sur la page d'accueil." };
}

export async function resetHomeAction(): Promise<FormState> {
  const g = await guard();
  if ("status" in g) return g;
  try {
    await resetHomeCarousels();
    logEvent("home_carousels_reset", {});
  } catch (error) {
    logEvent("home_carousels_reset_failed", { code: errorCode(error) });
    return FAILED;
  }
  done();
  return { status: "ok", message: "L'accueil a repris le contenu d'origine." };
}
