import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ORDER_STATUS_LABEL } from "@/components/account/orderStatus";
import { Card, formatDate, secondaryButton } from "@/components/account/ui";
import { getOrderForCustomer } from "@/lib/account/repository";
import { requireUser } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/format";
import { getWithdrawal, lookupOrderForWithdrawal } from "@/lib/withdrawals/repository";

export const metadata: Metadata = { title: "Commande" };

async function OrderContent({ params }: { params: PageProps<"/mon-compte/commandes/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/mon-compte/commandes/${encodeURIComponent(id)}`);
  // Another customer's order and a missing order give the same 404.
  const order = await getOrderForCustomer(user.uid, id);
  if (!order) notFound();
  const [withdrawal, eligible] = await Promise.all([getWithdrawal("order", id), lookupOrderForWithdrawal(id, { uid: user.uid })]);
  return (
    <Card title={`Commande du ${formatDate(order.createdAt)}`}>
      <p className="font-semibold text-ink">{ORDER_STATUS_LABEL[order.status] ?? order.status}</p>
      <ul className="mt-4 divide-y divide-secondary/30">
        {order.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-4 py-2">
            <span>
              {l.quantity} × {l.name}
              {l.personalisation && <span className="block text-sm text-ink-muted">« {l.personalisation} »</span>}
            </span>
            <span className="font-bold">{formatPrice(l.unitPriceCents * l.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-1 border-t border-secondary/40 pt-3">
        <div className="flex justify-between">
          <dt>Livraison</dt>
          <dd>{formatPrice(order.shippingCents)}</dd>
        </div>
        <div className="flex justify-between font-bold">
          <dt>Total</dt>
          <dd>{formatPrice(order.totalCents)}</dd>
        </div>
      </dl>
      {order.shippingAddress && (
        <address className="mt-4 not-italic text-sm text-ink">
          <span className="block font-bold">Livraison</span>
          {order.shippingAddress.fullName}, {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}, {order.shippingAddress.postalCode} {order.shippingAddress.city}
        </address>
      )}
      {withdrawal ? (
        <p className="mt-6 rounded-lg bg-surface-muted px-4 py-3 text-sm text-ink">
          Rétractation reçue le {formatDate(withdrawal.receivedAt)}. L&apos;adresse de retour vous a été envoyée par e-mail.
        </p>
      ) : (
        eligible.kind === "ok" && (
          <div className="mt-6 border-t border-secondary/40 pt-4">
            <p className="text-sm text-ink-muted">Vous disposez de 14 jours après la réception de votre commande pour vous rétracter.</p>
            <Link
              href={`/retractation?commande=${encodeURIComponent(id)}`}
              className={`mt-2 ${secondaryButton}`}
            >
              Se rétracter du contrat ici
            </Link>
          </div>
        )
      )}
      <Link href="/mon-compte/commandes" className="mt-6 inline-block font-bold text-link hover:underline">
        Retour aux commandes
      </Link>
    </Card>
  );
}

export default function OrderPage({ params }: PageProps<"/mon-compte/commandes/[id]">) {
  return (
    <Suspense fallback={<p role="status" className="text-ink-muted">Chargement de la commande…</p>}>
      <OrderContent params={params} />
    </Suspense>
  );
}
