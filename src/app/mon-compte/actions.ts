"use server";

import { liftUnsubscribe } from "@/lib/email/store";
import { emailHash } from "@/lib/email/unsubscribe";
import { refresh } from "next/cache";
import {
  AddressLimitError,
  addAddress,
  createDataRequest,
  deleteAddress,
  setNewsletterConsent,
  updateAddress,
  updateDisplayName,
} from "@/lib/account/repository";
import { validateAddress, validateDisplayName, type FieldErrors } from "@/lib/account/validation";
import { requireUser } from "@/lib/auth/dal";
import { errorCode, logEvent } from "@/lib/log";
import { allowAction } from "@/lib/security/limit";

/**
 * Account writes. Each action reads the uid from the verified session cookie
 * (never from the form), checks the rate limit, validates every field again.
 */
export type FormState = { status: "idle" | "ok" | "error"; message?: string; errors?: FieldErrors; values?: Record<string, string> };

/** Echoes the typed text fields back, so a form that fails validation keeps what the user typed (React resets forms after an action). */
function echo(formData: FormData, names: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of names) {
    const v = formData.get(name);
    if (typeof v === "string") values[name] = v.slice(0, 200);
  }
  return values;
}
const ADDRESS_FIELDS = ["label", "fullName", "line1", "line2", "postalCode", "city", "country"] as const;

const RATE_LIMITED: FormState = { status: "error", message: "Trop de modifications d'affilée. Réessayez dans quelques minutes." };
const FAILED: FormState = { status: "error", message: "L'enregistrement n'a pas abouti. Réessayez plus tard." };

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await allowAction("account:write", user.uid))) return RATE_LIMITED;
  const name = validateDisplayName(formData.get("displayName"));
  if (!name.ok) return { status: "error", errors: name.errors, message: "Vérifiez le champ indiqué.", values: echo(formData, ["displayName"]) };
  try {
    await updateDisplayName(user.uid, name.value);
  } catch (error) {
    logEvent("profile_update_error", { code: errorCode(error) });
    return FAILED;
  }
  refresh();
  return { status: "ok", message: "Profil enregistré." };
}

export async function updateConsentsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await allowAction("account:write", user.uid))) return RATE_LIMITED;
  try {
    const granted = formData.get("newsletter") === "on";
    await setNewsletterConsent(user.uid, granted, "account");
    // A new opt-in from the account lifts a previous unsubscribe (never a bounce or a complaint).
    if (granted && user.email) await liftUnsubscribe(emailHash(user.email));
  } catch (error) {
    logEvent("consent_update_error", { code: errorCode(error) });
    return FAILED;
  }
  refresh();
  return { status: "ok", message: "Préférences enregistrées." };
}

export async function saveAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/mon-compte/adresses");
  if (!(await allowAction("account:write", user.uid))) return RATE_LIMITED;
  const parsed = validateAddress(Object.fromEntries(formData));
  if (!parsed.ok) return { status: "error", errors: parsed.errors, message: "Vérifiez les champs indiqués.", values: echo(formData, ADDRESS_FIELDS) };
  const id = formData.get("id");
  try {
    if (typeof id === "string" && id) {
      if (!/^[A-Za-z0-9]{1,40}$/.test(id) || !(await updateAddress(user.uid, id, parsed.value))) {
        return { status: "error", message: "Cette adresse n'existe plus." };
      }
    } else {
      await addAddress(user.uid, parsed.value);
    }
  } catch (error) {
    if (error instanceof AddressLimitError) return { status: "error", message: "Vous avez atteint le nombre maximum d'adresses. Supprimez-en une d'abord." };
    logEvent("address_save_error", { code: errorCode(error) });
    return FAILED;
  }
  refresh();
  return { status: "ok", message: "Adresse enregistrée." };
}

export async function deleteAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/mon-compte/adresses");
  if (!(await allowAction("account:write", user.uid))) return RATE_LIMITED;
  const id = formData.get("id");
  if (typeof id !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(id)) return { status: "error", message: "Adresse introuvable." };
  try {
    await deleteAddress(user.uid, id);
  } catch (error) {
    logEvent("address_delete_error", { code: errorCode(error) });
    return FAILED;
  }
  refresh();
  return { status: "ok", message: "Adresse supprimée." };
}

/** Deletion (or export) request: recorded for the admin, nothing is deleted automatically. */
export async function requestDataAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/mon-compte/donnees");
  const type = formData.get("type");
  if (type !== "deletion" && type !== "export") return { status: "error", message: "Demande inconnue." };
  if (type === "deletion" && formData.get("confirm") !== "on") {
    return { status: "error", errors: { confirm: "Cochez la case pour confirmer." }, message: "Confirmez la demande." };
  }
  if (!(await allowAction("account:data-request", user.uid))) return { status: "error", message: "Vous avez déjà envoyé plusieurs demandes aujourd'hui." };
  try {
    const result = await createDataRequest(user.uid, user.email, type);
    refresh();
    return {
      status: "ok",
      message: result === "already_pending" ? "Une demande de ce type est déjà en cours de traitement." : "Demande enregistrée. Nous reviendrons vers vous par e-mail.",
    };
  } catch (error) {
    logEvent("data_request_error", { code: errorCode(error) });
    return FAILED;
  }
}
