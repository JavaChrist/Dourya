"use client";

import { useActionState } from "react";
import { setWithdrawalStatusAction } from "@/app/admin/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage, secondaryButton } from "@/components/account/ui";
import type { WithdrawalStatus } from "@/lib/withdrawals/eligibility";

const idle: FormState = { status: "idle" };

function StatusButton({ id, to, label }: { id: string; to: "refunded" | "closed"; label: string }) {
  const [state, action, pending] = useActionState(setWithdrawalStatusAction, idle);
  return (
    <form action={action} className="space-y-2">
      {state.status === "error" && <FormMessage state={state} />}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <button type="submit" disabled={pending} className={secondaryButton}>
        {pending ? "Enregistrement…" : label}
      </button>
    </form>
  );
}

/** « Marquer remboursée » then « Clore »: only the moves allowed by canMoveTo are shown. */
export function WithdrawalStatusButtons({ id, status }: { id: string; status: WithdrawalStatus }) {
  if (status === "closed") return null;
  return (
    <div className="flex flex-wrap gap-3">
      {status === "received" && <StatusButton id={id} to="refunded" label="Marquer remboursée" />}
      <StatusButton id={id} to="closed" label="Clore" />
    </div>
  );
}
