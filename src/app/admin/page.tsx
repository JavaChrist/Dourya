import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { MarkDoneButton } from "@/components/admin/MarkDoneButton";
import { Card, formatDate, secondaryButton } from "@/components/account/ui";
import { listDataRequests } from "@/lib/account/repository";
import { signOutAction } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Tableau de bord" };

const TYPE_LABEL = { export: "Export des données", deletion: "Suppression du compte" } as const;

async function AdminContent() {
  const admin = await requireAdmin();
  const requests = await listDataRequests();
  const pending = requests.filter((r) => r.status === "pending");
  const done = requests.filter((r) => r.status === "done");
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold text-pink-strong">Administration</h1>
          <p className="mt-1 text-ink-muted">Session : {admin.email}</p>
        </div>
        <form action={signOutAction}>
          <input type="hidden" name="scope" value="admin" />
          <button type="submit" className={secondaryButton}>
            <LogOut aria-hidden className="size-4" />
            Se déconnecter
          </button>
        </form>
      </div>

      <div className="mt-8 space-y-6">
        <Card title={`Demandes RGPD en attente (${pending.length})`}>
          {pending.length === 0 ? (
            <p className="text-ink-muted">Aucune demande en attente.</p>
          ) : (
            <ul className="divide-y divide-secondary/30">
              {pending.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="text-ink">
                    <p className="font-semibold">{TYPE_LABEL[r.type]}</p>
                    <p className="text-sm text-ink-muted">
                      {r.email} · {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <MarkDoneButton id={r.id} label={`${TYPE_LABEL[r.type]}, ${r.email}`} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {done.length > 0 && (
          <Card title="Demandes traitées">
            <ul className="divide-y divide-secondary/30">
              {done.map((r) => (
                <li key={r.id} className="py-2 text-sm text-ink">
                  {TYPE_LABEL[r.type]} · {r.email} · traitée le {formatDate(r.handledAt)}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="Prêt à ouvrir">
          <p className="text-ink-muted">Contrôle avant l&apos;ouverture de la vente : clés, e-mails, TVA, expédition, produits. Lecture seule, aucune clé affichée.</p>
          <Link href="/admin/pret-a-ouvrir" className={`${secondaryButton} mt-4`}>
            Voir le contrôle
          </Link>
        </Card>

        <Card title="Commandes">
          <p className="text-ink-muted">Commandes payées à fabriquer, préparer et expédier (numéro de suivi), statut des e-mails envoyés au client.</p>
          <Link href="/admin/commandes" className={`${secondaryButton} mt-4`}>
            Ouvrir les commandes
          </Link>
        </Card>

        <Card title="Catalogue">
          <p className="text-ink-muted">Rubriques, fiches produits et photos. Les nouvelles rubriques visibles apparaissent dans la boutique ; une fiche n&apos;y apparaît qu&apos;une fois complète et publiée. La vente reste fermée.</p>
          <Link href="/admin/catalogue" className={`${secondaryButton} mt-4`}>
            Ouvrir le catalogue
          </Link>
        </Card>

        <Card title="Mail Club">
          <p className="text-ink-muted">Pack du mois, packs payés à envoyer et abonnés. Les paiements et résiliations sont gérés par Stripe.</p>
          <Link href="/admin/mail-club" className={`${secondaryButton} mt-4`}>
            Ouvrir le Mail Club
          </Link>
        </Card>

        <Card title="Rétractations">
          <p className="text-ink-muted">Demandes de rétractation reçues en ligne (commandes et Mail Club) : délai, articles, remboursement à faire dans Stripe.</p>
          <Link href="/admin/retractations" className={`${secondaryButton} mt-4`}>
            Ouvrir les rétractations
          </Link>
        </Card>
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<p role="status" className="text-ink-muted">Chargement…</p>}>
      <AdminContent />
    </Suspense>
  );
}
