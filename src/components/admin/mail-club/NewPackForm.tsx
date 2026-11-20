"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createPackAction } from "@/app/admin/mail-club/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage } from "@/components/account/ui";
import { Field, SubmitButton } from "@/components/auth/FormParts";

const idle: FormState = { status: "idle" };

/** Month + title: the fiche is created as a draft, then its page opens to add photos and text. */
export function NewPackForm({ defaultMonth }: { defaultMonth: string }) {
  const [state, action, pending] = useActionState(createPackAction, idle);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Field id="month" name="month" type="month" label="Mois du pack" required defaultValue={state.values?.month ?? defaultMonth} error={state.errors?.month} />
        <Field id="title" name="title" label="Titre du pack" required maxLength={120} defaultValue={state.values?.title ?? ""} error={state.errors?.title} />
      </div>
      <SubmitButton pending={pending} pendingLabel="Création…">
        <Plus aria-hidden className="size-4" />
        Créer la fiche du mois
      </SubmitButton>
    </form>
  );
}
