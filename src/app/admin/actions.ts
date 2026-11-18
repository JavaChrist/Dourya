"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/app/mon-compte/actions";
import { markDataRequestDone } from "@/lib/account/repository";
import { requireAdmin } from "@/lib/auth/dal";
import { errorCode, logEvent } from "@/lib/log";
import { allowAction } from "@/lib/security/limit";

/** Marks a data request as handled. The admin role is checked again here, not only on the page. */
export async function markRequestDoneAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!(await allowAction("account:write", admin.uid))) return { status: "error", message: "Trop d'actions d'affilée. Réessayez dans quelques minutes." };
  const id = formData.get("id");
  if (typeof id !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(id)) return { status: "error", message: "Demande introuvable." };
  try {
    if (!(await markDataRequestDone(id, admin.uid))) return { status: "error", message: "Demande introuvable." };
  } catch (error) {
    logEvent("data_request_done_error", { code: errorCode(error) });
    return { status: "error", message: "L'enregistrement n'a pas abouti." };
  }
  logEvent("data_request_done", { id });
  refresh();
  return { status: "ok", message: "Demande marquée comme traitée." };
}
