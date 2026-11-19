import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import { ClearCartOnPaid } from "@/components/checkout/ClearCartOnPaid";
import { refreshOrderState, type ReturnState } from "@/lib/checkout/service";
import { getStripe } from "@/lib/payments/stripe";
import { allowAction } from "@/lib/security/limit";

export const metadata: Metadata = { title: "Suivi du paiement", robots: { index: false } };

const ORDER_ID = /^[A-Za-z0-9_-]{1,128}$/;

const VIEWS: Record<ReturnState, { title: string; text: string; icon: typeof Clock }> = {
  paid: { title: "Commande confirmée", text: "Votre paiement est confirmé. Merci ! Vous recevrez le suivi de votre commande par e-mail.", icon: CheckCircle2 },
  refunded: { title: "Commande remboursée", text: "Cette commande a été remboursée.", icon: CheckCircle2 },
  pending: { title: "Paiement en cours de vérification", text: "Nous attendons la confirmation de notre prestataire de paiement. Cela prend en général quelques secondes : actualisez la page.", icon: Clock },
  failed: { title: "Paiement refusé", text: "Le paiement n'a pas abouti et aucun montant n'a été débité. Votre panier est conservé : vous pouvez réessayer.", icon: XCircle },
  cancelled: { title: "Paiement annulé", text: "Le paiement a été annulé. Votre panier est conservé : vous pouvez réessayer.", icon: XCircle },
  expired: { title: "Paiement expiré", text: "Le délai de paiement est dépassé. Votre panier est conservé : vous pouvez réessayer.", icon: XCircle },
  unknown: { title: "Commande introuvable", text: "Nous ne trouvons pas cette commande. Si vous avez été débité, contactez-nous avec la référence affichée sur votre relevé.", icon: XCircle },
};

async function ReturnContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).commande;
  const orderId = typeof raw === "string" && ORDER_ID.test(raw) ? raw : null;
  // The browser return proves nothing: the state comes from Stripe, re-read on the server.
  const state: ReturnState = !orderId || !(await allowAction("checkout:return")) ? "unknown" : await refreshOrderState(orderId, getStripe());
  const view = VIEWS[state];
  const Icon = view.icon;
  const retry = state === "failed" || state === "cancelled" || state === "expired";
  return (
    <div className="mt-8 rounded-lg bg-white p-6 ring-1 ring-secondary/30 sm:p-8" role="status">
      {state === "paid" && <ClearCartOnPaid />}
      <Icon aria-hidden className={`size-10 ${state === "paid" ? "text-success" : "text-pink-strong"}`} />
      <h2 className="mt-3 font-display text-3xl font-semibold text-ink">{view.title}</h2>
      <p className="mt-2 text-ink">{view.text}</p>
      {orderId && state !== "unknown" && <p className="mt-3 text-sm text-ink-muted">Référence de commande : {orderId}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        {state === "pending" && (
          <Link href={`/commande/retour?commande=${encodeURIComponent(orderId ?? "")}`} prefetch={false} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-button px-6 font-semibold text-button-ink">
            <RefreshCw aria-hidden className="size-4" />
            Actualiser
          </Link>
        )}
        {retry && (
          <Link href="/panier" className="inline-flex min-h-11 items-center rounded-full bg-button px-6 font-semibold text-button-ink">
            Revenir au panier
          </Link>
        )}
        <Link href="/boutique" className="inline-flex min-h-11 items-center rounded-full border-2 border-secondary/50 bg-white px-5 font-semibold text-ink hover:border-ink">
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-pink-strong">Votre commande</h1>
      <Suspense fallback={<p className="mt-8 text-ink-muted" role="status">Vérification du paiement…</p>}>
        <ReturnContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
