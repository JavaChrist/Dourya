"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/dal";
import { getStripe } from "@/lib/payments/stripe";
import { allowAction } from "@/lib/security/limit";
import { getUserSubscription } from "@/lib/subscriptions/repository";
import { cancelMailClub } from "@/lib/subscriptions/service";
import { cleanName } from "@/lib/withdrawals/eligibility";
import { withdrawMailClub } from "@/lib/withdrawals/service";

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

const WITHDRAW_MESSAGES = {
  ok: "Rétractation enregistrée : votre abonnement est arrêté, aucun nouveau prélèvement. Un accusé de réception vous est envoyé par e-mail ; nous revenons vers vous pour le remboursement.",
  pending: "Rétractation enregistrée. L'arrêt de l'abonnement n'a pas pu être confirmé tout de suite : nous l'arrêtons nous-mêmes et revenons vers vous.",
  already: "Votre rétractation est déjà enregistrée.",
  none: "Aucun abonnement en cours.",
  error: "La rétractation n'a pas pu être enregistrée. Réessayez dans un instant ou écrivez à contact@dourya.fr.",
  rate_limited: MESSAGES.rate_limited,
  login: MESSAGES.login,
} as const;

/**
 * Withdrawal from the Mail Club (CGV article 7): stops the subscription at
 * once at Stripe. The refund is made by DOURYA in Stripe.
 */
export async function withdrawMailClubAction(): Promise<CancelState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: WITHDRAW_MESSAGES.login };
  if (!(await allowAction("withdrawal:submit", user.uid))) return { status: "error", message: WITHDRAW_MESSAGES.rate_limited };
  const sub = await getUserSubscription(user.uid);
  const name = cleanName(sub?.shipping?.name) ?? "Madame, Monsieur";
  const result = await withdrawMailClub({ uid: user.uid, name, email: user.email }, getStripe(), new Date());
  revalidatePath("/mon-compte/abonnement");
  return { status: result === "error" || result === "none" ? "error" : "ok", message: WITHDRAW_MESSAGES[result] };
}
