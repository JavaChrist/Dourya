"use client";

import { useActionState, useRef, type FormEvent } from "react";
import { setFulfilmentAction } from "@/app/admin/commandes/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage, primaryButton, secondaryButton } from "@/components/account/ui";
import { inputClass } from "@/components/auth/FormParts";
import { useConfirm, type ConfirmOptions } from "@/components/ui/ConfirmDialog";
import { CARRIERS } from "@/lib/orders/carriers";
import type { FulfilmentStatus } from "@/lib/orders/types";

const idle: FormState = { status: "idle" };

function MoveButton({ id, to, label, confirm, proof }: { id: string; to: FulfilmentStatus; label: string; confirm?: ConfirmOptions; proof?: "tracking" | "manual" }) {
  const [state, action, pending] = useActionState(setFulfilmentAction, idle);
  const [ask, dialog] = useConfirm();
  const form = useRef<HTMLFormElement>(null);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (!confirm) return;
    event.preventDefault();
    if (await ask(confirm)) form.current?.requestSubmit();
  };
  return (
    <form ref={form} action={action} onSubmit={confirm ? (e) => void onSubmit(e) : undefined} className="space-y-2">
      {state.status === "error" && <FormMessage state={state} />}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      {proof && <input type="hidden" name="proof" value={proof} />}
      <button type="submit" disabled={pending} className={secondaryButton}>
        {pending ? "Enregistrement…" : label}
      </button>
      {dialog}
    </form>
  );
}

function ShipForm({ id, tracked }: { id: string; tracked: boolean }) {
  const [state, action, pending] = useActionState(setFulfilmentAction, idle);
  const [ask, dialog] = useConfirm();
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    event.preventDefault();
    const ok = await ask({
      title: "Marquer la commande expédiée ?",
      message: "Le client reçoit l'e-mail « Votre commande est en route », avec le numéro de suivi s'il est indiqué. Il n'est envoyé qu'une fois.",
      confirmLabel: "Marquer expédiée",
    });
    if (ok) {
      confirmed.current = true;
      form.current?.requestSubmit();
    }
  };
  return (
    <form ref={form} action={action} onSubmit={(e) => void onSubmit(e)} className="w-full space-y-3 rounded-2xl border-2 border-secondary/30 p-4">
      {state.status === "error" && <FormMessage state={state} />}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value="shipped" />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold text-ink">
          Transporteur
          <select name="carrier" defaultValue={CARRIERS[0]} className={`${inputClass} px-3 text-sm`}>
            {CARRIERS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-ink">
          N° de suivi{tracked ? " (obligatoire)" : " (si suivi)"}
          <input name="trackingNumber" required={tracked} maxLength={40} autoComplete="off" className={`${inputClass} px-3 text-sm`} />
        </label>
        <label className="text-sm font-semibold text-ink">
          Lien de suivi (facultatif)
          <input name="trackingUrl" type="url" maxLength={300} placeholder="https://" autoComplete="off" className={`${inputClass} px-3 text-sm`} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Enregistrement…" : "Marquer expédiée"}
      </button>
      {dialog}
    </form>
  );
}

/** Next fulfilment moves allowed for an order (same rules as nextFulfilmentStatus on the server). */
export function OrderFulfilmentControls({ id, status, canFulfil, tracked, hasTracking }: { id: string; status: FulfilmentStatus | null; canFulfil: boolean; tracked: boolean; hasTracking: boolean }) {
  if (status === null || status === "returned") return null;
  const returned = (
    <MoveButton
      id={id}
      to="returned"
      label="Retour reçu"
      confirm={{ title: "Marquer le colis retourné ?", message: "À utiliser quand le colis revient (rétractation, adresse erronée). Le remboursement se fait dans Stripe.", confirmLabel: "Marquer retourné" }}
    />
  );
  if (!canFulfil) return status === "shipped" || status === "delivered" ? <div className="flex flex-wrap gap-3">{returned}</div> : null;
  return (
    <div className="flex flex-wrap items-start gap-3">
      {status === "to_produce" && <MoveButton id={id} to="preparing" label="Fabrication terminée : en préparation" />}
      {status === "preparing" && <MoveButton id={id} to="ready" label="Prête à expédier" />}
      {status === "ready" && (
        <>
          <ShipForm id={id} tracked={tracked} />
          <MoveButton id={id} to="preparing" label="Revenir en préparation" />
        </>
      )}
      {status === "shipped" && (
        <>
          <MoveButton
            id={id}
            to="delivered"
            label="Marquer livrée"
            proof={hasTracking ? "tracking" : "manual"}
            confirm={{
              title: "Marquer la commande livrée ?",
              message: hasTracking ? "Vérifiez d'abord sur le suivi du transporteur que le colis est livré." : "Sans suivi, confirmez seulement si le client a indiqué l'avoir reçu.",
              confirmLabel: "Marquer livrée",
            }}
          />
          {returned}
        </>
      )}
      {status === "delivered" && returned}
    </div>
  );
}
