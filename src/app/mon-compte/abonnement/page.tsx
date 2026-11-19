import type { Metadata } from "next";
import { Suspense } from "react";
import { Gift } from "lucide-react";
import { Card, formatDate } from "@/components/account/ui";
import { Notice } from "@/components/auth/FormParts";
import { CancelSubscription } from "@/components/mail-club/CancelSubscription";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { requireUser } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/format";
import { LIVE_STATUSES, type SubscriptionStatus } from "@/lib/payments/stripe-subscriptions";
import { getStripe } from "@/lib/payments/stripe";
import { getUserSubscription, listUserDeliveries } from "@/lib/subscriptions/repository";
import { confirmMailClubReturn } from "@/lib/subscriptions/service";

export const metadata: Metadata = { title: "Abonnement" };

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  incomplete: "Paiement en attente",
  incomplete_expired: "Paiement non abouti",
  trialing: "Actif",
  active: "Actif",
  past_due: "Paiement en retard",
  unpaid: "Paiement en échec",
  canceled: "Terminé",
  paused: "En pause",
};

async function SubscriptionContent({ searchParams }: { searchParams: PageProps<"/mon-compte/abonnement">["searchParams"] }) {
  const user = await requireUser("/mon-compte/abonnement");
  const { session } = await searchParams;
  // Back from Stripe: saved at once, without waiting for the webhook.
  if (typeof session === "string" && session) await confirmMailClubReturn(user.uid, session, getStripe(), new Date());

  const [sub, deliveries] = await Promise.all([getUserSubscription(user.uid), listUserDeliveries(user.uid)]);
  if (!sub) {
    return (
      <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-secondary/50 px-6 py-10 text-center">
        <Gift aria-hidden className="size-8 text-pink-strong" />
        <p className="mt-2 font-semibold text-ink">
          {session ? "Votre abonnement est en cours d'enregistrement. Rechargez la page dans un instant." : "Vous n'êtes pas abonné au Mail Club."}
        </p>
        {!session && (
          <ButtonLink href="/infos/mail-club" className="mt-5">
            Découvrir le Mail Club
          </ButtonLink>
        )}
      </div>
    );
  }

  const live = LIVE_STATUSES.includes(sub.status);
  const end = formatDate(sub.currentPeriodEnd);
  return (
    <div className="space-y-5">
      {session && live && <Notice tone="success">Bienvenue au Mail Club ! Votre abonnement est actif.</Notice>}
      <dl className="grid gap-3 text-ink sm:grid-cols-2">
        <div>
          <dt className="text-sm text-ink-muted">Statut</dt>
          <dd className="font-semibold">{sub.cancelAtPeriodEnd && live ? "Résilié (fin de période)" : STATUS_LABEL[sub.status]}</dd>
        </div>
        {sub.priceCents !== null && (
          <div>
            <dt className="text-sm text-ink-muted">Prix</dt>
            <dd className="font-semibold">{formatPrice(sub.priceCents)} par mois, livraison incluse</dd>
          </div>
        )}
        {live && end && (
          <div>
            <dt className="text-sm text-ink-muted">{sub.cancelAtPeriodEnd ? "Fin de l'abonnement" : "Prochain prélèvement"}</dt>
            <dd className="font-semibold">{end}</dd>
          </div>
        )}
        {sub.shipping && (
          <div>
            <dt className="text-sm text-ink-muted">Adresse de livraison</dt>
            <dd className="font-semibold">
              {sub.shipping.name}
              <br />
              {sub.shipping.line1}
              {sub.shipping.line2 && (
                <>
                  <br />
                  {sub.shipping.line2}
                </>
              )}
              <br />
              {sub.shipping.postalCode} {sub.shipping.city}
            </dd>
          </div>
        )}
      </dl>

      {(sub.status === "past_due" || sub.status === "unpaid") && (
        <Notice tone="error">Le dernier prélèvement a échoué. Stripe va réessayer ; vérifiez votre moyen de paiement.</Notice>
      )}
      {live && sub.cancelAtPeriodEnd && (
        <Notice tone="info">Résiliation enregistrée : aucun nouveau prélèvement. Le pack déjà payé vous sera envoyé.</Notice>
      )}
      {live && !sub.cancelAtPeriodEnd && <CancelSubscription endLabel={end || "la fin du mois payé"} />}
      {!live && (
        <ButtonLink href="/infos/mail-club" variant="alt" className="border-2 border-secondary">
          Me réabonner
        </ButtonLink>
      )}

      <div>
        <h3 className="font-display text-xl font-semibold text-ink">Mes packs</h3>
        {deliveries.length === 0 ? (
          <p className="mt-2 text-ink-muted">Aucun pack pour le moment.</p>
        ) : (
          <ul className="mt-2 divide-y divide-secondary/30">
            {deliveries.map((d) => (
              <li key={d.id} className="flex min-h-12 items-center justify-between gap-4 py-2">
                <span>Pack payé le {formatDate(d.paidAt)}</span>
                <span className="text-sm font-semibold">{d.status === "sent" ? `Envoyé le ${formatDate(d.sentAt)}` : "En préparation"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function SubscriptionPage({ searchParams }: PageProps<"/mon-compte/abonnement">) {
  return (
    <Card title="Mail Club">
      <Suspense fallback={<p role="status" className="text-ink-muted">Chargement de l&apos;abonnement…</p>}>
        <SubscriptionContent searchParams={searchParams} />
      </Suspense>
    </Card>
  );
}
