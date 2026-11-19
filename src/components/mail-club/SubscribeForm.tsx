"use client";

import Link from "next/link";
import { useActionState } from "react";
import { subscribeMailClubAction, type SubscribeState } from "@/app/infos/mail-club/actions";
import { Notice, SubmitButton } from "@/components/auth/FormParts";

const initial: SubscribeState = { status: "idle" };

/** Terms checkbox + button. The server checks everything again (session, terms, existing subscription). */
export function SubscribeForm({ priceLabel }: { priceLabel: string }) {
  const [state, action, pending] = useActionState(subscribeMailClubAction, initial);
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          name="acceptTerms"
          required
          aria-invalid={state.termsError ? true : undefined}
          aria-describedby="mail-club-terms-note"
          className="mt-0.5 size-5 shrink-0 accent-pink-strong"
        />
        <span>
          J&apos;accepte les{" "}
          <Link href="/infos/cgv" className="font-bold underline">
            conditions générales de vente
          </Link>{" "}
          et un abonnement mensuel de {priceLabel}, reconduit chaque mois à la date anniversaire jusqu&apos;à résiliation.
        </span>
      </label>
      <p id="mail-club-terms-note" className="text-sm text-ink-muted">
        Résiliable à tout moment depuis votre compte : aucun nouveau prélèvement après la résiliation, le mois déjà payé est envoyé.
      </p>
      {state.status === "error" && state.message && <Notice tone="error">{state.message}</Notice>}
      <SubmitButton pending={pending} pendingLabel="Redirection vers le paiement…">
        M&apos;abonner pour {priceLabel}
      </SubmitButton>
    </form>
  );
}
