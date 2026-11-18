import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Package } from "lucide-react";
import { ORDER_STATUS_LABEL } from "@/components/account/orderStatus";
import { Card, formatDate } from "@/components/account/ui";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { listOrders } from "@/lib/account/repository";
import { requireUser } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Commandes" };

async function OrdersContent() {
  const user = await requireUser("/mon-compte/commandes");
  const orders = await listOrders(user.uid);
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-secondary/50 px-6 py-10 text-center">
        <Package aria-hidden className="size-8 text-pink-strong" />
        <p className="mt-2 font-semibold text-ink">Vous n&apos;avez pas encore passé de commande.</p>
        <ButtonLink href="/boutique" className="mt-5">
          Découvrir la boutique
        </ButtonLink>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-secondary/30">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/mon-compte/commandes/${o.id}`} className="flex min-h-14 items-center gap-4 py-3 hover:text-pink-strong">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Commande du {formatDate(o.createdAt)}</span>
              <span className="block text-sm text-ink-muted">
                {ORDER_STATUS_LABEL[o.status] ?? o.status} · {o.itemCount} article{o.itemCount > 1 ? "s" : ""}
              </span>
            </span>
            <span className="font-bold">{formatPrice(o.totalCents)}</span>
            <ChevronRight aria-hidden className="size-5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function OrdersPage() {
  return (
    <Card title="Historique des commandes">
      <Suspense fallback={<p role="status" className="text-ink-muted">Chargement des commandes…</p>}>
        <OrdersContent />
      </Suspense>
    </Card>
  );
}
