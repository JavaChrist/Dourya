import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, formatDate } from "@/components/account/ui";
import { AdminHeader } from "@/components/admin/catalog/shared";
import { MarkSentButton } from "@/components/admin/mail-club/MarkSentButton";
import { PackForm } from "@/components/admin/mail-club/PackForm";
import { requireAdmin } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/format";
import { LIVE_STATUSES } from "@/lib/payments/stripe-subscriptions";
import { getMailClubPack, listDeliveries, listSubscriptions } from "@/lib/subscriptions/repository";

export const metadata: Metadata = { title: "Mail Club" };

/** Pack of the month, packs to post (one per paid invoice) and subscriptions. No e-mail or uid shown. */
async function MailClubAdmin() {
  await requireAdmin();
  const [pack, toSend, subs] = await Promise.all([getMailClubPack(), listDeliveries("to_send"), listSubscriptions()]);
  const live = subs.filter((s) => LIVE_STATUSES.includes(s.status));
  const cancelling = live.filter((s) => s.cancelAtPeriodEnd).length;

  return (
    <>
      <AdminHeader title="Mail Club" back={{ href: "/admin", label: "Administration" }} />
      <div className="mt-8 space-y-6">
        <Card title="Pack du mois">
          <PackForm pack={pack} />
        </Card>

        <Card title={`Packs à envoyer (${toSend.length})`}>
          {toSend.length === 0 ? (
            <p className="text-ink-muted">Aucun pack à envoyer.</p>
          ) : (
            <ul className="divide-y divide-secondary/30">
              {toSend.map((d) => (
                <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="text-ink">
                    <p className="font-semibold">
                      Payé le {formatDate(d.paidAt)} · {formatPrice(d.amountCents)}
                    </p>
                    {d.shipping ? (
                      <address className="text-sm not-italic text-ink-muted">
                        {d.shipping.name}, {d.shipping.line1}
                        {d.shipping.line2 ? `, ${d.shipping.line2}` : ""}, {d.shipping.postalCode} {d.shipping.city} ({d.shipping.country})
                      </address>
                    ) : (
                      <p className="text-sm font-bold text-pink-strong">Adresse manquante : voir l&apos;abonnement dans Stripe.</p>
                    )}
                  </div>
                  <MarkSentButton id={d.id} label={`pack payé le ${formatDate(d.paidAt)}`} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Abonnés">
          <p className="text-ink">
            <strong>{live.length}</strong> abonnement{live.length > 1 ? "s" : ""} en cours
            {cancelling > 0 ? `, dont ${cancelling} résilié${cancelling > 1 ? "s" : ""} en fin de période` : ""}.
          </p>
          {live.length > 0 && (
            <ul className="mt-3 divide-y divide-secondary/30">
              {live.map((s) => (
                <li key={s.id} className="py-2 text-sm text-ink">
                  {s.shipping ? `${s.shipping.name}, ${s.shipping.city}` : "Adresse inconnue"} · depuis le {formatDate(s.createdAt)} ·{" "}
                  {s.cancelAtPeriodEnd ? `fin le ${formatDate(s.currentPeriodEnd)}` : `prochain prélèvement le ${formatDate(s.currentPeriodEnd)}`}
                  {s.status === "past_due" || s.status === "unpaid" ? " · paiement en échec" : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export default function AdminMailClubPage() {
  return (
    <Suspense fallback={<p role="status" className="text-ink-muted">Chargement…</p>}>
      <MailClubAdmin />
    </Suspense>
  );
}
