import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, formatDate } from "@/components/account/ui";
import { AdminHeader } from "@/components/admin/catalog/shared";
import { OrderFulfilmentControls } from "@/components/admin/OrderFulfilmentControls";
import { requireAdmin } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/format";
import { orderNotificationStatuses, type NotificationStatus } from "@/lib/notifications/service";
import { listRecentOrders } from "@/lib/orders/repository";
import { canFulfil } from "@/lib/orders/transitions";
import type { FulfilmentStatus, OrderRecord, PaymentStatus } from "@/lib/orders/types";

export const metadata: Metadata = { title: "Commandes" };

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  draft: "Brouillon",
  awaiting_payment: "Paiement en attente",
  paid: "Payée",
  cancelled: "Annulée",
  expired: "Expirée",
  failed: "Paiement échoué",
  partially_refunded: "Remboursée en partie",
  refunded: "Remboursée",
};

const FULFILMENT_LABEL: Record<FulfilmentStatus, string> = {
  to_produce: "À fabriquer",
  preparing: "En préparation",
  ready: "Prête à expédier",
  shipped: "Expédiée",
  delivered: "Livrée",
  returned: "Retournée",
};

const EMAIL_LABEL: Record<NotificationStatus, string> = { pending: "en cours", sent: "envoyé", failed: "échec", disabled: "désactivé" };

type Emails = Awaited<ReturnType<typeof orderNotificationStatuses>>;

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "strong" }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone === "strong" ? "bg-pink-strong text-white" : "bg-surface-muted text-ink"}`}>{children}</span>
  );
}

const TO_HANDLE: readonly (FulfilmentStatus | null)[] = ["to_produce", "preparing", "ready"];
const isToHandle = (o: OrderRecord) => canFulfil(o.paymentStatus) && TO_HANDLE.includes(o.fulfilmentStatus);
const isInTransit = (o: OrderRecord) => o.fulfilmentStatus === "shipped";

function OrderItem({ o, emails }: { o: OrderRecord; emails: Emails }) {
  const a = o.shippingAddress;
  const emailParts = (
    [
      ["confirmed", "confirmation"],
      ["shipped", "expédition"],
      ["refunded", "remboursement"],
    ] as const
  )
    .filter(([k]) => emails[k])
    .map(([k, label]) => `${label} ${EMAIL_LABEL[emails[k]!]}`);
  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {o.fulfilmentStatus && <Badge tone={isToHandle(o) ? "strong" : "muted"}>{FULFILMENT_LABEL[o.fulfilmentStatus]}</Badge>}
        <Badge>{PAYMENT_LABEL[o.paymentStatus]}</Badge>
        {o.needsReview && <Badge tone="strong">À vérifier</Badge>}
        {emails.confirmed === "failed" || emails.shipped === "failed" || emails.refunded === "failed" ? <Badge tone="strong">E-mail en échec</Badge> : null}
        <span className="font-semibold text-ink">Commande n° {o.id}</span>
        <span className="text-sm text-ink-muted">
          du {formatDate(o.createdAt)} · {formatPrice(o.totalCents)}
          {o.refundedCents > 0 ? ` · remboursé ${formatPrice(o.refundedCents)}` : ""}
        </span>
      </div>
      <ul className="list-disc pl-5 text-sm text-ink">
        {o.lines.map((l, i) => (
          <li key={i}>
            {l.quantity} × {l.productName}
            {l.variantName ? ` (${l.variantName})` : ""}
            {l.stockMode === "made_to_order" ? " · sur commande" : ""}
            {l.personalisation ? " · personnalisé" : ""}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink">
        {a.fullName} · {a.line1}
        {a.line2 ? `, ${a.line2}` : ""} · {a.postalCode} {a.city} · {a.country}
      </p>
      <p className="text-sm text-ink-muted">
        {o.shipping.label}
        {o.shipping.service === "tracked" ? " · suivi obligatoire" : ""}
        {o.tracking ? ` · ${o.tracking.carrier} ${o.tracking.number}` : ""}
        {emailParts.length > 0 ? ` · e-mails : ${emailParts.join(", ")}` : ""}
      </p>
      {o.needsReview && <p className="text-sm font-semibold text-ink">Point à vérifier : {o.needsReview}</p>}
      <OrderFulfilmentControls
        id={o.id}
        status={o.fulfilmentStatus}
        canFulfil={canFulfil(o.paymentStatus)}
        tracked={o.shipping.service === "tracked"}
        hasTracking={Boolean(o.tracking?.number)}
      />
    </li>
  );
}

function OrderList({ orders, emails }: { orders: OrderRecord[]; emails: Map<string, Emails> }) {
  return (
    <ul className="mt-2 divide-y divide-secondary/30">
      {orders.map((o) => (
        <OrderItem key={o.id} o={o} emails={emails.get(o.id) ?? {}} />
      ))}
    </ul>
  );
}

async function OrdersAdmin() {
  await requireAdmin();
  // Orders never paid (abandoned checkouts) are not shown.
  const orders = (await listRecentOrders()).filter((o) => o.fulfilmentStatus !== null || o.needsReview);
  const emails = new Map(await Promise.all(orders.map(async (o) => [o.id, await orderNotificationStatuses(o.id)] as const)));
  const toHandle = orders.filter(isToHandle);
  const inTransit = orders.filter((o) => !isToHandle(o) && isInTransit(o));
  const others = orders.filter((o) => !isToHandle(o) && !isInTransit(o));
  return (
    <>
      <AdminHeader title="Commandes" back={{ href: "/admin", label: "Administration" }} />
      <div className="mt-8 space-y-6">
        <Card title={`À traiter (${toHandle.length})`}>
          <p className="text-ink-muted">
            Commandes payées à fabriquer, préparer ou expédier. Le client reçoit un e-mail à l&apos;expédition (une seule fois). Les remboursements se font dans Stripe ;
            le client en est informé automatiquement.
          </p>
          {toHandle.length === 0 ? <p className="mt-4 text-ink-muted">Aucune commande à traiter.</p> : <OrderList orders={toHandle} emails={emails} />}
        </Card>
        <Card title={`En route (${inTransit.length})`}>
          {inTransit.length === 0 ? <p className="text-ink-muted">Aucune commande en route.</p> : <OrderList orders={inTransit} emails={emails} />}
        </Card>
        {others.length > 0 && (
          <Card title={`Autres commandes (${others.length})`}>
            <OrderList orders={others} emails={emails} />
          </Card>
        )}
      </div>
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<p role="status" className="text-ink-muted">Chargement…</p>}>
      <OrdersAdmin />
    </Suspense>
  );
}
