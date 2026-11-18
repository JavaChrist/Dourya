"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { markRequestDoneAction } from "@/app/admin/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage, secondaryButton } from "@/components/account/ui";

const idle: FormState = { status: "idle" };

export function MarkDoneButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(markRequestDoneAction, idle);
  return (
    <form action={action} className="space-y-2">
      {state.status === "error" && <FormMessage state={state} />}
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={secondaryButton} aria-label={`Marquer comme traitée : ${label}`}>
        <Check aria-hidden className="size-4" />
        Marquer comme traitée
      </button>
    </form>
  );
}
