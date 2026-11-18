"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { MapPin, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { deleteAddressAction, saveAddressAction, type FormState } from "@/app/mon-compte/actions";
import { Field, inputClass } from "@/components/auth/FormParts";
import type { SavedAddress } from "@/lib/account/repository";
import { FormMessage, primaryButton, secondaryButton } from "./ui";

const idle: FormState = { status: "idle" };
type Country = { code: string; name: string };

export function AddressBook({ addresses, countries, max }: { addresses: SavedAddress[]; countries: readonly Country[]; max: number }) {
  // null = no form open, "new" = add form, otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [deleteState, deleteAction, deleting] = useActionState(deleteAddressAction, idle);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <FormMessage state={deleteState} />
      {addresses.length === 0 && editing !== "new" && (
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-secondary/50 px-6 py-10 text-center">
          <MapPin aria-hidden className="size-8 text-pink-strong" />
          <p className="mt-2 font-semibold text-ink">Aucune adresse enregistrée.</p>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {addresses.map((a) =>
          editing === a.id ? (
            <li key={a.id} className="sm:col-span-2">
              <AddressForm address={a} countries={countries} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={a.id} className="rounded-lg bg-white p-4 ring-1 ring-secondary/30">
              {a.label && <p className="text-sm font-bold text-pink-strong">{a.label}</p>}
              <address className="not-italic text-ink">
                <span className="block font-semibold">{a.fullName}</span>
                <span className="block">{a.line1}</span>
                {a.line2 && <span className="block">{a.line2}</span>}
                <span className="block">
                  {a.postalCode} {a.city}
                </span>
                <span className="block">{countries.find((c) => c.code === a.country)?.name ?? a.country}</span>
              </address>
              {confirmId === a.id ? (
                <form action={deleteAction} className="mt-3 rounded-md bg-surface-muted p-3" onSubmit={() => setConfirmId(null)}>
                  <input type="hidden" name="id" value={a.id} />
                  <p className="text-sm font-semibold text-ink">Supprimer cette adresse ?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="submit" disabled={deleting} className={secondaryButton}>
                      <Trash2 aria-hidden className="size-4" />
                      Oui, supprimer
                    </button>
                    <button type="button" className={secondaryButton} onClick={() => setConfirmId(null)}>
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={secondaryButton} onClick={() => setEditing(a.id)} aria-label={`Modifier l'adresse de ${a.fullName}`}>
                    <Pencil aria-hidden className="size-4" />
                    Modifier
                  </button>
                  <button type="button" className={secondaryButton} onClick={() => setConfirmId(a.id)} aria-label={`Supprimer l'adresse de ${a.fullName}`}>
                    <Trash2 aria-hidden className="size-4" />
                    Supprimer
                  </button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>

      {editing === "new" ? (
        <AddressForm countries={countries} onDone={() => setEditing(null)} />
      ) : addresses.length < max ? (
        <button type="button" className={primaryButton} onClick={() => setEditing("new")}>
          <Plus aria-hidden className="size-5" />
          Ajouter une adresse
        </button>
      ) : (
        <p className="text-sm text-ink-muted">Vous avez atteint le maximum de {max} adresses.</p>
      )}
    </div>
  );
}

function AddressForm({ address, countries, onDone }: { address?: SavedAddress; countries: readonly Country[]; onDone: () => void }) {
  const id = useId();
  const [state, action, pending] = useActionState(saveAddressAction, idle);
  const e = state.errors ?? {};
  const v = (name: keyof SavedAddress) => state.values?.[name] ?? address?.[name];

  useEffect(() => {
    if (state.status === "ok") onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="space-y-4 rounded-lg bg-white p-5 ring-2 ring-secondary/40" aria-busy={pending} aria-label={address ? "Modifier l'adresse" : "Nouvelle adresse"}>
      <FormMessage state={state} />
      {address && <input type="hidden" name="id" value={address.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-label`} name="label" label="Nom de l'adresse (facultatif)" placeholder="Maison, travail…" defaultValue={v("label")} maxLength={40} error={e.label} />
        <Field id={`${id}-fullName`} name="fullName" label="Destinataire" defaultValue={v("fullName")} autoComplete="name" required maxLength={80} error={e.fullName} />
        <div className="sm:col-span-2">
          <Field id={`${id}-line1`} name="line1" label="Adresse" defaultValue={v("line1")} autoComplete="address-line1" required maxLength={120} error={e.line1} />
        </div>
        <div className="sm:col-span-2">
          <Field id={`${id}-line2`} name="line2" label="Complément (facultatif)" defaultValue={v("line2")} autoComplete="address-line2" maxLength={120} error={e.line2} />
        </div>
        <Field id={`${id}-postalCode`} name="postalCode" label="Code postal" defaultValue={v("postalCode")} autoComplete="postal-code" inputMode="numeric" required maxLength={10} error={e.postalCode} />
        <Field id={`${id}-city`} name="city" label="Ville" defaultValue={v("city")} autoComplete="address-level2" required maxLength={80} error={e.city} />
        <div>
          <label htmlFor={`${id}-country`} className="block text-sm font-bold text-ink">
            Pays
          </label>
          <select
            id={`${id}-country`}
            name="country"
            defaultValue={v("country") ?? countries[0]?.code}
            autoComplete="country"
            aria-invalid={e.country ? true : undefined}
            aria-describedby={e.country ? `${id}-country-error` : undefined}
            className={inputClass}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          {e.country && (
            <p id={`${id}-country-error`} className="mt-1 text-sm font-bold text-pink-strong">
              {e.country}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          <Save aria-hidden className="size-5" />
          Enregistrer l&apos;adresse
        </button>
        <button type="button" className={secondaryButton} onClick={onDone}>
          <X aria-hidden className="size-4" />
          Annuler
        </button>
      </div>
    </form>
  );
}
