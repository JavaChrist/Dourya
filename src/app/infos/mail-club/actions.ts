"use server";

import { redirect } from "next/navigation";
import { siteOrigin } from "@/config/site";
import { getSessionUser } from "@/lib/auth/dal";
import { checkoutSwitch } from "@/lib/checkout/test-preview";
import { getStripe, stripeMode } from "@/lib/payments/stripe";
import { isStripeCheckoutUrl } from "@/lib/payments/stripe-client";
import { allowAction } from "@/lib/security/limit";
import { startMailClub } from "@/lib/subscriptions/service";

export type SubscribeState = { status: "idle" | "error"; message?: string; termsError?: boolean };

const MESSAGES = {
  closed: "L'abonnement en ligne ouvrira prochainement.",
  already: "Vous êtes déjà abonné au Mail Club. Retrouvez votre abonnement dans votre compte.",
  terms: "Cochez la case pour accepter les conditions de l'abonnement.",
  unverified: "Confirmez d'abord votre adresse e-mail (lien reçu à l'inscription), puis réessayez.",
  error: "L'abonnement n'a pas pu être préparé. Réessayez dans un instant.",
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
} as const;

/** Starts the subscription on Stripe's hosted page. Signed-in, verified customers only. */
export async function subscribeMailClubAction(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const user = await getSessionUser();
  if (!user) redirect("/connexion?next=/infos/mail-club");
  if (!(await allowAction("mailclub:subscribe", user.uid))) return { status: "error", message: MESSAGES.rate_limited };
  if (!user.emailVerified) return { status: "error", message: MESSAGES.unverified };

  const result = await startMailClub({
    user: { uid: user.uid, email: user.email },
    acceptTerms: formData.get("acceptTerms") === "on",
    stripe: getStripe(),
    sw: checkoutSwitch(process.env, stripeMode()),
    origin: siteOrigin(),
    now: new Date(),
  });
  if (result.kind === "redirect") {
    // Only Stripe's hosted page.
    if (!isStripeCheckoutUrl(result.url)) return { status: "error", message: MESSAGES.error };
    redirect(result.url);
  }
  if (result.kind === "terms") return { status: "error", message: MESSAGES.terms, termsError: true };
  return { status: "error", message: MESSAGES[result.kind] };
}
