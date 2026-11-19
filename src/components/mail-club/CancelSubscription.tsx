"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelMailClubAction, type CancelState } from "@/app/mon-compte/abonnement/actions";
import { Notice } from "@/components/auth/FormParts";
import { secondaryButton } from "@/components/account/ui";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/** "Résilier" with the site's confirmation modal (never window.confirm). */
export function CancelSubscription({ endLabel }: { endLabel: string }) {
  const [ask, confirmDialog] = useConfirm();
  const [state, setState] = useState<CancelState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        className={secondaryButton}
        onClick={async () => {
          const ok = await ask({
            title: "Résilier le Mail Club ?",
            message: `Plus aucun prélèvement ne sera effectué. Votre abonnement reste actif jusqu'au ${endLabel} et le pack déjà payé vous sera envoyé.`,
            confirmLabel: "Résilier",
            cancelLabel: "Garder mon abonnement",
            tone: "danger",
          });
          if (!ok) return;
          startTransition(async () => {
            setState(await cancelMailClubAction());
            router.refresh();
          });
        }}
      >
        {pending ? "Résiliation…" : "Résilier mon abonnement"}
      </button>
      {state.status !== "idle" && state.message && <Notice tone={state.status === "ok" ? "success" : "error"}>{state.message}</Notice>}
      {confirmDialog}
    </div>
  );
}
