"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { withdrawMailClubAction, type CancelState } from "@/app/mon-compte/abonnement/actions";
import { Notice } from "@/components/auth/FormParts";
import { secondaryButton } from "@/components/account/ui";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/** Mail Club withdrawal (CGV article 7): stops the subscription at once. Site modal, never window.confirm. */
export function WithdrawSubscription() {
  const [ask, confirmDialog] = useConfirm();
  const [state, setState] = useState<CancelState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        Vous pouvez vous rétracter dans les 14 jours suivant la réception de votre premier pack. L&apos;abonnement est alors arrêté tout de suite.
      </p>
      <button
        type="button"
        disabled={pending}
        className={secondaryButton}
        onClick={async () => {
          const ok = await ask({
            title: "Se rétracter du Mail Club ?",
            message:
              "Votre abonnement sera arrêté immédiatement : plus aucun prélèvement ni envoi. Vous recevrez un accusé de réception par e-mail et nous reviendrons vers vous pour le remboursement.",
            confirmLabel: "Confirmer la rétractation",
            cancelLabel: "Garder mon abonnement",
            tone: "danger",
          });
          if (!ok) return;
          startTransition(async () => {
            setState(await withdrawMailClubAction());
            router.refresh();
          });
        }}
      >
        {pending ? "Envoi…" : "Se rétracter du contrat ici"}
      </button>
      {state.status !== "idle" && state.message && <Notice tone={state.status === "ok" ? "success" : "error"}>{state.message}</Notice>}
      {confirmDialog}
    </div>
  );
}
