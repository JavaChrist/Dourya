"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/app/mon-compte/actions";
import { requireAdmin } from "@/lib/auth/dal";
import { catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { errorCode, logEvent } from "@/lib/log";
import { saveShippingSettings } from "@/lib/orders/repository";
import { allowAction } from "@/lib/security/limit";
import { parseShippingForm } from "@/lib/shipping/form";

/**
 * Admin → Expédition: zones, rates and free-shipping threshold. Admin role
 * (again, not only on the page), admin open here (same gate as the
 * catalogue), rate limit, validation, then the whole settings/shipping
 * document is replaced. Checkout stays closed: these rates are only used
 * once payment is opened.
 */
export async function saveShippingAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!catalogAdminEnabled(process.env)) return { status: "error", message: "L'administration n'est pas ouverte ici. Rien n'a été enregistré." };
  if (!(await allowAction("catalog:write", admin.uid))) return { status: "error", message: "Trop de modifications d'affilée. Réessayez dans quelques minutes." };
  const parsed = parseShippingForm(form);
  if (!parsed.ok) return { status: "error", message: "Vérifiez les champs signalés. Rien n'a été enregistré.", errors: parsed.errors };
  try {
    await saveShippingSettings(parsed.value, admin.uid);
  } catch (error) {
    logEvent("shipping_settings_save_failed", { code: errorCode(error) });
    return { status: "error", message: "L'enregistrement n'a pas abouti. Réessayez plus tard." };
  }
  logEvent("shipping_settings_saved", { rates: parsed.value.rates.length, zones: parsed.value.zones.filter((z) => z.enabled).length });
  refresh();
  return { status: "ok", message: "Expédition enregistrée." };
}
