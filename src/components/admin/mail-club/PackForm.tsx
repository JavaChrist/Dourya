"use client";

import { useActionState } from "react";
import { saveMailClubPackAction } from "@/app/admin/mail-club/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage } from "@/components/account/ui";
import { Field, SubmitButton } from "@/components/auth/FormParts";
import { labelClass, textareaClass } from "@/components/admin/catalog/shared";

const idle: FormState = { status: "idle" };

export function PackForm({ pack }: { pack: { title: string; description: string } | null }) {
  const [state, action, pending] = useActionState(saveMailClubPackAction, idle);
  const v = (name: "title" | "description") => state.values?.[name] ?? pack?.[name] ?? "";
  return (
    <form action={action} className="space-y-4">
      <Field id="title" label="Titre du pack" required maxLength={120} defaultValue={v("title")} error={state.errors?.title} />
      <div>
        <label htmlFor="description" className={labelClass}>
          Description (affichée sur la page Mail Club)
        </label>
        <textarea
          id="description"
          name="description"
          maxLength={2000}
          defaultValue={v("description")}
          aria-invalid={state.errors?.description ? true : undefined}
          className={textareaClass}
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Enregistrement…">
        Enregistrer le pack du mois
      </SubmitButton>
    </form>
  );
}
