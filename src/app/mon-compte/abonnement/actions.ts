"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/dal";
import { getStripe } from "@/lib/payments/stripe";
import { allowAction } from "@/lib/security/limit";
import { cancelMailClub } from "@/lib/subscriptions/service";

export type CancelState = { status: "idle" | "ok" | "error"; message?: string };

const MESSAGES = {
  ok: "Votre abonnement est résilié : aucun nouveau prélèvement. Le mois déjà payé vous sera envoyé.",
  already: "La résiliation est déjà enregistrée.",
  none: "Aucun abonnement en cours.",
  error: "La résiliation n'a pas pu être enregistrée. Réessayez dans un instant.",
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
  login: "Votre session a expiré. Reconnectez-vous.",
} as const;

/** Cancels at the end of the paid period (Stripe), for the signed-in customer's own subscription only. */
export async function cancelMailClubAction(): Promise<CancelState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: MESSAGES.login };
  if (!(await allowAction("mailclub:cancel", user.uid))) return { status: "error", message: MESSAGES.rate_limited };
  const result = await cancelMailClub(user.uid, getStripe(), new Date());
  revalidatePath("/mon-compte/abonnement");
  return { status: result === "ok" || result === "already" ? "ok" : "error", message: MESSAGES[result] };
}
