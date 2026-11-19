"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { markDeliverySentAction } from "@/app/admin/mail-club/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage, secondaryButton } from "@/components/account/ui";

const idle: FormState = { status: "idle" };

export function MarkSentButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(markDeliverySentAction, idle);
  return (
    <form action={action} className="space-y-2">
      {state.status === "error" && <FormMessage state={state} />}
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={secondaryButton} aria-label={`Marquer envoyé : ${label}`}>
        <Check aria-hidden className="size-4" />
        Marquer envoyé
      </button>
    </form>
  );
}
