import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pencil } from "lucide-react";
import { Card, formatDate, secondaryButton } from "@/components/account/ui";
import { AdminHeader, CatalogClosed } from "@/components/admin/catalog/shared";
import { MarkSentButton } from "@/components/admin/mail-club/MarkSentButton";
import { NewPackForm } from "@/components/admin/mail-club/NewPackForm";
import { requireAdmin } from "@/lib/auth/dal";
import { catalogAdminState } from "@/lib/catalog/admin-gate";
import { formatPrice } from "@/lib/format";
import { LIVE_STATUSES } from "@/lib/payments/stripe-subscriptions";
import { packMonthLabel, splitPublished } from "@/lib/subscriptions/packs";
import { listPacks } from "@/lib/subscriptions/packs-repository";
import { listDeliveries, listSubscriptions } from "@/lib/subscriptions/repository";

export const metadata: Metadata = { title: "Mail Club" };

/** Next month in Paris time, "YYYY-MM": the usual month to prepare. */
function nextMonthId(now: Date): string {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).format(now).split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Monthly fiches (one per month), with their status. */
async function PackList() {
  const state = catalogAdminState(process.env);
  if (!state.enabled) return <CatalogClosed state={state} />;
  const packs = await listPacks();
  const { current } = splitPublished(packs);
  return (
    <div className="space-y-6">
      <p className="text-ink">
        Une fiche par mois (titre, texte, photos). Le pack <strong>publié</strong> le plus récent s&apos;affiche comme pack du mois sur la page Mail Club ; les autres packs publiés passent dans « Les packs précédents ». Un brouillon n&apos;est jamais visible.
      </p>
      <NewPackForm defaultMonth={nextMonthId(new Date())} />
      {packs.length === 0 ? (
        <p className="text-ink-muted">Aucune fiche pour l&apos;instant.</p>
      ) : (
        <ul className="divide-y divide-secondary/30">
          {packs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="text-ink">
                <p className="font-semibold">
                  {packMonthLabel(p.id)} · {p.title}
                </p>
                <p className="text-sm text-ink-muted">
                  {p.status === "published" ? (p.id === current?.id ? "Publié · pack du mois" : "Publié · packs précédents") : "Brouillon"} · {p.images.length} photo
                  {p.images.length > 1 ? "s" : ""}
                </p>
              </div>
              <Link href={`/admin/mail-club/packs/${p.id}`} className={secondaryButton} aria-label={`Modifier le pack ${packMonthLabel(p.id)}`}>
                <Pencil aria-hidden className="size-4" />
                Modifier
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Monthly packs, packs to post (one per paid invoice) and subscriptions. No e-mail or uid shown. */
async function MailClubAdmin() {
  await requireAdmin();
  const [allToSend, allSubs] = await Promise.all([listDeliveries("to_send"), listSubscriptions()]);
  // TEST data (Stripe test mode) is kept apart: never posted, never counted.
  const toSend = allToSend.filter((d) => !d.test);
  const live = allSubs.filter((s) => !s.test && LIVE_STATUSES.includes(s.status));
  const cancelling = live.filter((s) => s.cancelAtPeriodEnd).length;
  const testSubs = allSubs.filter((s) => s.test);
  const testPacks = allToSend.filter((d) => d.test);

  return (
    <>
      <AdminHeader title="Mail Club" back={{ href: "/admin", label: "Administration" }} />
      <div className="mt-8 space-y-6">
        <Card title="Packs du mois">
          <PackList />
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

        {(testSubs.length > 0 || testPacks.length > 0) && (
          <Card title="Données de TEST">
            <p className="text-ink">
              Abonnements payés en mode test Stripe : aucun prélèvement réel. Ils ne comptent pas dans les abonnés et leurs packs ne sont pas à envoyer.
            </p>
            <ul className="mt-3 divide-y divide-secondary/30">
              {testSubs.map((s) => (
                <li key={s.id} className="py-2 text-sm text-ink">
                  <span className="mr-2 rounded bg-secondary/30 px-1.5 py-0.5 text-xs font-bold">TEST</span>
                  Abonnement {s.status} · depuis le {formatDate(s.createdAt)} · {s.id}
                </li>
              ))}
              {testPacks.map((d) => (
                <li key={d.id} className="py-2 text-sm text-ink">
                  <span className="mr-2 rounded bg-secondary/30 px-1.5 py-0.5 text-xs font-bold">TEST</span>
                  Pack payé le {formatDate(d.paidAt)} · {formatPrice(d.amountCents)} · {d.id}
                </li>
              ))}
            </ul>
          </Card>
        )}
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
