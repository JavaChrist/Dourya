import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, formatDate } from "@/components/account/ui";
import { AdminHeader } from "@/components/admin/catalog/shared";
import { WithdrawalStatusButtons } from "@/components/admin/WithdrawalStatusButtons";
import { requireAdmin } from "@/lib/auth/dal";
import { addDays, WITHDRAWAL_DAYS, type WithdrawalRecord, type WithdrawalStatus } from "@/lib/withdrawals/eligibility";
import { listWithdrawals } from "@/lib/withdrawals/repository";

export const metadata: Metadata = { title: "Rétractations" };

const STATUS_LABEL: Record<WithdrawalStatus, string> = { received: "Reçue", refunded: "Remboursée", closed: "Close" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "strong" }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone === "strong" ? "bg-pink-strong text-white" : "bg-surface-muted text-ink"}`}>{children}</span>
  );
}

function WithdrawalItem({ w }: { w: WithdrawalRecord }) {
  const personalised = w.lines.some((l) => l.personalised);
  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={w.status === "received" ? "strong" : "muted"}>{STATUS_LABEL[w.status]}</Badge>
        {!w.livemode && <Badge>TEST</Badge>}
        {personalised && <Badge>Article personnalisé</Badge>}
        <span className="font-semibold text-ink">{w.kind === "order" ? `Commande n° ${w.ref}` : "Dopamine Mail Club"}</span>
      </div>
      <p className="text-sm text-ink">
        {w.name} · {w.email}
      </p>
      <ul className="list-disc pl-5 text-sm text-ink">
        {w.lines.map((l) => (
          <li key={l.index}>
            {l.quantity} × {l.productName}
            {l.variantName ? ` (${l.variantName})` : ""}
            {l.personalised ? " · personnalisé : exclu (L. 221-28), à vérifier" : ""}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">
        Reçue le {dateTime.format(new Date(w.receivedAt))}
        {w.orderCreatedAt ? ` · commande du ${formatDate(w.orderCreatedAt)}` : ""} · retour et remboursement avant le {formatDate(addDays(w.receivedAt, WITHDRAWAL_DAYS))}
        {w.kind === "mail_club" ? (w.stripeCancelled ? " · abonnement arrêté chez Stripe" : " · arrêt chez Stripe à vérifier") : ""}
        {w.handledAt ? ` · traitée le ${formatDate(w.handledAt)}` : ""}
      </p>
      <WithdrawalStatusButtons id={w.id} status={w.status} />
    </li>
  );
}

async function WithdrawalsAdmin() {
  await requireAdmin();
  const all = await listWithdrawals();
  const open = all.filter((w) => w.status !== "closed");
  const closed = all.filter((w) => w.status === "closed");
  return (
    <>
      <AdminHeader title="Rétractations" back={{ href: "/admin", label: "Administration" }} />
      <div className="mt-8 space-y-6">
        <Card title={`Demandes en cours (${open.length})`}>
          <p className="text-ink-muted">
            Vérifiez le délai de 14 jours et les articles personnalisés, puis remboursez dans Stripe (prix des articles et livraison standard) avant de marquer la
            demande remboursée.
          </p>
          {open.length === 0 ? <p className="mt-4 text-ink-muted">Aucune demande en cours.</p> : <ul className="mt-2 divide-y divide-secondary/30">{open.map((w) => <WithdrawalItem key={w.id} w={w} />)}</ul>}
        </Card>
        {closed.length > 0 && (
          <Card title={`Demandes closes (${closed.length})`}>
            <ul className="divide-y divide-secondary/30">
              {closed.map((w) => (
                <WithdrawalItem key={w.id} w={w} />
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

export default function AdminWithdrawalsPage() {
  return (
    <Suspense fallback={<p role="status" className="text-ink-muted">Chargement…</p>}>
      <WithdrawalsAdmin />
    </Suspense>
  );
}
