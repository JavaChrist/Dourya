import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WithdrawalForm } from "@/components/withdrawal/WithdrawalForm";
import { getSessionUser } from "@/lib/auth/dal";
import { isOrderRef } from "@/lib/withdrawals/eligibility";
import { lookupOrderForWithdrawal } from "@/lib/withdrawals/repository";
import type { FoundOrder } from "./actions";

export const metadata: Metadata = {
  title: "Rétractation",
  description: "Exercer votre droit de rétractation en ligne pour une commande DOURYA.",
  alternates: { canonical: "/retractation" },
};

/** The signed-in owner coming from Mon compte → Commandes skips the lookup step. */
async function FormLoader({ searchParams }: { searchParams: PageProps<"/retractation">["searchParams"] }) {
  const { commande } = await searchParams;
  const orderId = typeof commande === "string" && isOrderRef(commande) ? commande : "";
  const user = await getSessionUser();
  let initial: FoundOrder | null = null;
  if (user && orderId) {
    const found = await lookupOrderForWithdrawal(orderId, { uid: user.uid });
    if (found.kind === "ok" && !found.order.alreadyRequested) initial = { id: orderId, email: "", createdAt: found.order.createdAt, lines: found.order.lines };
  }
  return <WithdrawalForm defaultOrder={orderId} signedIn={Boolean(user)} initial={initial} />;
}

export default function WithdrawalPage({ searchParams }: PageProps<"/retractation">) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-pink-strong">Rétractation</h1>
      <div className="mt-4 space-y-3 leading-relaxed text-ink">
        <p>
          Vous disposez de 14 jours après la réception de votre commande pour vous rétracter, sans avoir à donner de motif. Indiquez votre numéro de commande et
          l&apos;adresse e-mail utilisée, choisissez les articles, puis confirmez : un accusé de réception vous est envoyé aussitôt par e-mail, avec l&apos;adresse
          de retour.
        </p>
        <p className="text-sm text-ink-muted">
          Les articles personnalisés selon vos indications sont exclus du droit de rétractation. Pour le Dopamine Mail Club, rendez-vous dans{" "}
          <Link href="/mon-compte/abonnement" className="text-pink-strong underline underline-offset-2">
            Mon compte → Abonnement
          </Link>
          . Conditions complètes :{" "}
          <Link href="/infos/cgv#retractation" className="text-pink-strong underline underline-offset-2">
            CGV, article 7
          </Link>
          .
        </p>
      </div>
      <div className="mt-8 rounded-2xl border-2 border-secondary/40 bg-white p-5 sm:p-7">
        <Suspense fallback={<p role="status" className="text-ink-muted">Chargement…</p>}>
          <FormLoader searchParams={searchParams} />
        </Suspense>
      </div>
    </article>
  );
}
