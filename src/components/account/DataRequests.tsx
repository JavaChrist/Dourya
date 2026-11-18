"use client";

import { useActionState } from "react";
import { Download, Trash2 } from "lucide-react";
import { requestDataAction, type FormState } from "@/app/mon-compte/actions";
import { FormMessage, secondaryButton } from "./ui";

const idle: FormState = { status: "idle" };

export function ExportLink() {
  return (
    // Plain link: the route handler checks the session and returns a JSON file.
    <a href="/mon-compte/export" download className={secondaryButton}>
      <Download aria-hidden className="size-4" />
      Télécharger mes données (JSON)
    </a>
  );
}

export function DeletionRequestForm({ pending: alreadyPending }: { pending: boolean }) {
  const [state, action, pending] = useActionState(requestDataAction, idle);
  if (alreadyPending && state.status === "idle") {
    return <p className="rounded-md bg-surface-muted px-4 py-3 text-sm font-semibold text-ink">Votre demande de suppression est en cours de traitement.</p>;
  }
  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      <FormMessage state={state} />
      <input type="hidden" name="type" value="deletion" />
      <label className="flex cursor-pointer gap-3 text-ink">
        <input
          type="checkbox"
          name="confirm"
          className="mt-1 size-5 shrink-0 accent-primary"
          aria-invalid={state.errors?.confirm ? true : undefined}
          aria-describedby={state.errors?.confirm ? "confirm-error" : undefined}
        />
        <span>Je demande la suppression de mon compte et des données associées.</span>
      </label>
      {state.errors?.confirm && (
        <p id="confirm-error" className="text-sm font-bold text-pink-strong">
          {state.errors.confirm}
        </p>
      )}
      <button type="submit" disabled={pending} className={secondaryButton}>
        <Trash2 aria-hidden className="size-4" />
        Envoyer la demande de suppression
      </button>
    </form>
  );
}
