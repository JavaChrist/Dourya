"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateConsentsAction, updateProfileAction, type FormState } from "@/app/mon-compte/actions";
import { Field } from "@/components/auth/FormParts";
import { FormMessage, formatDate, primaryButton } from "./ui";

const idle: FormState = { status: "idle" };

export function ProfileForm({ email, displayName }: { email: string; displayName: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, idle);
  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      <FormMessage state={state} />
      <div>
        <p className="text-sm font-bold text-ink">Adresse e-mail</p>
        <p className="mt-1 text-ink">{email}</p>
      </div>
      <Field id="displayName" label="Prénom et nom (facultatif)" defaultValue={state.values?.displayName ?? displayName} maxLength={80} autoComplete="name" error={state.errors?.displayName} />
      <button type="submit" disabled={pending} className={primaryButton}>
        <Save aria-hidden className="size-5" />
        Enregistrer
      </button>
    </form>
  );
}

export function ConsentForm({ granted, updatedAt }: { granted: boolean; updatedAt: string | null }) {
  const [state, action, pending] = useActionState(updateConsentsAction, idle);
  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      <FormMessage state={state} />
      <label className="flex cursor-pointer gap-3 text-ink">
        <input type="checkbox" name="newsletter" defaultChecked={granted} className="mt-1 size-5 shrink-0 accent-primary" aria-labelledby="newsletter-label" aria-describedby="newsletter-help" />
        <span>
          <span id="newsletter-label" className="block font-semibold">Recevoir les nouveautés par e-mail</span>
          <span id="newsletter-help" className="block text-sm text-ink-muted">
            Facultatif, désactivable à tout moment. Les e-mails liés à vos commandes sont envoyés dans tous les cas.
            {updatedAt && ` Dernière modification : ${formatDate(updatedAt)}.`}
          </span>
        </span>
      </label>
      <button type="submit" disabled={pending} className={primaryButton}>
        <Save aria-hidden className="size-5" />
        Enregistrer mes préférences
      </button>
    </form>
  );
}
