import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { CalendarClock, Gift, Truck, XCircle } from "lucide-react";
import { mailClubConfig } from "@/config/commerce";
import { Notice } from "@/components/auth/FormParts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SubscribeForm } from "@/components/mail-club/SubscribeForm";
import { getSessionUser } from "@/lib/auth/dal";
import { checkoutSwitch } from "@/lib/checkout/test-preview";
import { formatPrice } from "@/lib/format";
import { LIVE_STATUSES } from "@/lib/payments/stripe-subscriptions";
import { getStripe, stripeMode } from "@/lib/payments/stripe";
import { getMailClubPack, getUserSubscription } from "@/lib/subscriptions/repository";
import { mailClubGate } from "@/lib/subscriptions/service";

export const metadata: Metadata = { title: "Mail Club", alternates: { canonical: "/infos/mail-club" } };

const priceLabel = `${formatPrice(mailClubConfig.priceCents)} par mois`;

const points = [
  { icon: Gift, text: "Un pack surprise différent chaque mois." },
  { icon: Truck, text: "Livraison incluse dans le prix, en France." },
  { icon: CalendarClock, text: "Prélèvement chaque mois à la date anniversaire de votre abonnement." },
  { icon: XCircle, text: "Sans engagement : résiliable à tout moment depuis votre compte." },
];

/** Pack of the month and the customer's state: request-time data. */
async function MailClubLive() {
  await connection();
  const [pack, user] = await Promise.all([getMailClubPack(), getSessionUser()]);
  const stripe = getStripe();
  const closed = mailClubGate(stripe, checkoutSwitch(process.env, stripeMode()));
  const current = user ? await getUserSubscription(user.uid) : null;
  const subscribed = current !== null && LIVE_STATUSES.includes(current.status);

  return (
    <>
      <section aria-labelledby="pack-du-mois" className="rounded-lg bg-white p-5 ring-1 ring-secondary/30 sm:p-6">
        <h2 id="pack-du-mois" className="font-display text-2xl font-semibold text-ink">
          Le pack du mois
        </h2>
        {pack ? (
          <div className="mt-3 space-y-2 text-ink">
            <p className="font-bold">{pack.title}</p>
            {pack.description && <p className="whitespace-pre-line">{pack.description}</p>}
          </div>
        ) : (
          <p className="mt-3 text-ink-muted">Le contenu du prochain pack sera annoncé bientôt.</p>
        )}
      </section>

      <section aria-labelledby="abonnement" className="rounded-lg bg-white p-5 ring-1 ring-secondary/30 sm:p-6">
        <h2 id="abonnement" className="font-display text-2xl font-semibold text-ink">
          M&apos;abonner
        </h2>
        <div className="mt-4">
          {closed ? (
            <Notice tone="info">L&apos;abonnement en ligne ouvrira prochainement.</Notice>
          ) : subscribed ? (
            <div className="space-y-4">
              <Notice tone="success">Vous êtes abonné au Mail Club.</Notice>
              <ButtonLink href="/mon-compte/abonnement">Voir mon abonnement</ButtonLink>
            </div>
          ) : user ? (
            <SubscribeForm priceLabel={priceLabel} />
          ) : (
            <div className="space-y-4">
              <p className="text-ink">Connectez-vous ou créez un compte pour vous abonner : vous pourrez suivre et résilier votre abonnement depuis votre compte.</p>
              <ButtonLink href="/connexion?next=/infos/mail-club">Se connecter</ButtonLink>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default function MailClubPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-pink-strong">Le Mail Club DOURYA</h1>
      <p className="mt-4 text-lg text-ink">
        <strong>{priceLabel}</strong>, livraison incluse.
      </p>
      <ul className="mt-6 space-y-3">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3 text-ink">
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-pink-strong" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 space-y-6">
        <Suspense fallback={<div aria-busy="true" className="min-h-64" />}>
          <MailClubLive />
        </Suspense>
      </div>
    </div>
  );
}
