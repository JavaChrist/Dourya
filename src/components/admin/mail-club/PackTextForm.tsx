"use client";

import { useActionState } from "react";
import { savePackTextAction } from "@/app/admin/mail-club/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage } from "@/components/account/ui";
import { Field, SubmitButton } from "@/components/auth/FormParts";
import { FieldError, labelClass, textareaClass } from "@/components/admin/catalog/shared";

const idle: FormState = { status: "idle" };

export function PackTextForm({ packId, title, description }: { packId: string; title: string; description: string }) {
  const [state, action, pending] = useActionState(savePackTextAction, idle);
  const v = (name: "title" | "description", fallback: string) => state.values?.[name] ?? fallback;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="packId" value={packId} />
      <FormMessage state={state} />
      <Field id="title" name="title" label="Titre du pack" required maxLength={120} defaultValue={v("title", title)} error={state.errors?.title} />
      <div>
        <label htmlFor="description" className={labelClass}>
          Description (affichée sur la page Mail Club)
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          maxLength={2000}
          defaultValue={v("description", description)}
          aria-invalid={state.errors?.description ? true : undefined}
          aria-describedby={state.errors?.description ? "description-error" : undefined}
          className={textareaClass}
        />
        <FieldError id="description" error={state.errors?.description} />
      </div>
      <SubmitButton pending={pending} pendingLabel="Enregistrement…">
        Enregistrer le texte
      </SubmitButton>
    </form>
  );
}
