"use client";

import { useActionState } from "react";
import { confirmUnsubscribeAction, type UnsubscribeState } from "@/app/desinscription/actions";
import { Notice, SubmitButton } from "@/components/auth/FormParts";
import { ButtonLink } from "@/components/ui/ButtonLink";

const idle: UnsubscribeState = { status: "idle" };

const MESSAGES = {
  invalid: "Ce lien de désinscription n'est pas valide.",
  rate_limited: "Trop de demandes. Réessayez dans quelques minutes.",
  unavailable: "La désinscription est momentanément indisponible. Réessayez plus tard.",
} as const;

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmUnsubscribeAction, idle);

  if (state.status === "done") {
    return (
      <div className="space-y-5">
        <Notice tone="success">C&apos;est fait : vous êtes désinscrit(e) de la newsletter DOURYA.</Notice>
        <ButtonLink href="/" className="w-full">
          Retour à la boutique
        </ButtonLink>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      {state.status !== "idle" && <Notice tone="error">{MESSAGES[state.status]}</Notice>}
      <input type="hidden" name="token" value={token} />
      <SubmitButton pending={pending} pendingLabel="Désinscription…">
        Confirmer la désinscription
      </SubmitButton>
    </form>
  );
}
