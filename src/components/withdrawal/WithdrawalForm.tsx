"use client";

import { useActionState, useState } from "react";
import { lookupWithdrawalAction, submitWithdrawalAction, type FoundOrder, type LookupState, type SubmitState } from "@/app/retractation/actions";
import { Field, Notice, SubmitButton } from "@/components/auth/FormParts";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

/**
 * Two steps: find the order (number + e-mail, or the signed-in account), then
 * pick the items and confirm with « Confirmer la rétractation ».
 * `initial` is set when the signed-in owner comes from Mon compte → Commandes.
 */
export function WithdrawalForm({ defaultOrder, signedIn, initial }: { defaultOrder: string; signedIn: boolean; initial: FoundOrder | null }) {
  const [lookup, lookupAction, looking] = useActionState<LookupState, FormData>(lookupWithdrawalAction, initial ? { status: "found", order: initial } : { status: "idle" });
  const [submit, submitAction, submitting] = useActionState<SubmitState, FormData>(submitWithdrawalAction, { status: "idle" });
  const [picked, setPicked] = useState<Set<number> | null>(null);

  if (submit.status === "done") {
    return (
      <Notice tone="success">
        <p className="font-semibold">Votre demande de rétractation est enregistrée.</p>
        <p className="mt-1">
          Commande n° {submit.orderId}, reçue le {dateTime.format(new Date(submit.receivedAt))}. Un accusé de réception avec l&apos;adresse de retour vous est envoyé
          par e-mail. Vous avez 14 jours pour renvoyer les articles.
        </p>
      </Notice>
    );
  }

  if (lookup.status === "already") {
    return <Notice tone="info">Une demande de rétractation est déjà enregistrée pour la commande n° {lookup.orderId}. L&apos;accusé de réception vous a été envoyé par e-mail.</Notice>;
  }

  if (lookup.status === "found") {
    const order = lookup.order;
    const selected = picked ?? new Set(order.lines.map((l) => l.index));
    const toggle = (index: number) => {
      const next = new Set(selected);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      setPicked(next);
    };
    return (
      <form action={submitAction} className="space-y-5">
        <input type="hidden" name="commande" value={order.id} />
        <input type="hidden" name="email" value={order.email} />
        <p className="text-ink">
          Commande n° <strong>{order.id}</strong>
          {order.createdAt ? ` du ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(order.createdAt))}` : ""}
        </p>
        <fieldset>
          <legend className="font-semibold text-ink">Articles concernés par la rétractation</legend>
          <ul className="mt-2 divide-y divide-secondary/30">
            {order.lines.map((l) => (
              <li key={l.index}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                  <input type="checkbox" name="lines" value={l.index} checked={selected.has(l.index)} onChange={() => toggle(l.index)} className="size-5 accent-pink-strong" />
                  <span>
                    {l.quantity} × {l.productName}
                    {l.variantName ? ` (${l.variantName})` : ""}
                    {l.personalised && <span className="block text-sm text-ink-muted">Article personnalisé : exclu du droit de rétractation, nous vérifions votre demande.</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <Field id="name" name="name" label="Nom et prénom" autoComplete="name" required minLength={2} maxLength={80} />
        <p className="text-sm text-ink-muted">
          En confirmant, vous notifiez à DOURYA votre décision de vous rétracter du contrat pour les articles cochés. Les frais de retour sont à votre charge.
        </p>
        {submit.status === "error" && <Notice tone="error">{submit.message}</Notice>}
        <SubmitButton pending={submitting} pendingLabel="Envoi…">
          Confirmer la rétractation
        </SubmitButton>
      </form>
    );
  }

  return (
    <form action={lookupAction} className="space-y-4">
      <Field id="commande" name="commande" label="Numéro de commande" defaultValue={defaultOrder} required autoComplete="off" spellCheck={false} />
      <Field
        id="email"
        name="email"
        type="email"
        label="Adresse e-mail de la commande"
        autoComplete="email"
        required={!signedIn}
        hint={signedIn ? "Facultatif si la commande a été passée avec votre compte." : undefined}
      />
      {lookup.status === "error" && <Notice tone="error">{lookup.message}</Notice>}
      <SubmitButton pending={looking} pendingLabel="Recherche…">
        Trouver ma commande
      </SubmitButton>
    </form>
  );
}
