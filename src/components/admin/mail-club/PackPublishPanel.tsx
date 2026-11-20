"use client";

import Link from "next/link";
import { useActionState, type MouseEvent } from "react";
import { CheckCircle2, CircleAlert, ExternalLink, Send, Undo2 } from "lucide-react";
import { setPackStatusAction } from "@/app/admin/mail-club/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage, primaryButton, secondaryButton } from "@/components/account/ui";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { PackStatus } from "@/lib/subscriptions/packs";

const idle: FormState = { status: "idle" };
const publishButton = primaryButton.replace("disabled:cursor-wait", "").trim();

/**
 * Publication of a monthly pack. `missing` comes from packReadiness() on the
 * server, checked again by the action. The latest published month is shown
 * as « le pack du mois », the older ones under « Les packs précédents ».
 */
export function PackPublishPanel({ packId, monthLabel, status, missing, isCurrent }: { packId: string; monthLabel: string; status: PackStatus; missing: string[]; isCurrent: boolean }) {
  const [state, action, pending] = useActionState(setPackStatusAction, idle);
  const [ask, confirmDialog] = useConfirm();
  const ready = missing.length === 0;
  const confirmThen = (options: Parameters<typeof ask>[0]) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const button = e.currentTarget;
    void ask(options).then((ok) => {
      if (ok) button.form?.requestSubmit(button);
    });
  };
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="packId" value={packId} />
      <FormMessage state={state} />
      {confirmDialog}
      <p className="text-ink">
        Statut : <strong>{status === "published" ? "Publié" : "Brouillon"}</strong>
        {status === "published" && (isCurrent ? " · affiché comme pack du mois" : " · affiché dans « Les packs précédents »")}
      </p>
      {ready ? (
        <p className="flex items-center gap-2 font-semibold text-ink">
          <CheckCircle2 aria-hidden className="size-5 text-success" />
          {status === "published" ? "Fiche complète" : "Prêt à publier"}
        </p>
      ) : (
        <div>
          <p className="flex items-center gap-2 font-semibold text-ink">
            <CircleAlert aria-hidden className="size-5 text-pink-strong" />
            Avant de publier :
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-ink">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {status !== "published" && (
          <button
            type="submit"
            name="status"
            value="published"
            disabled={!ready || pending}
            aria-disabled={!ready || pending}
            title={!ready ? "Complétez d'abord les points listés ci-dessus." : undefined}
            className={`${publishButton} ${pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"}`}
            onClick={confirmThen({
              title: `Publier le pack ${monthLabel} ?`,
              message:
                "Il apparaîtra sur la page Mail Club avec ses photos. S'il s'agit du mois le plus récent, il devient le pack du mois et le précédent passe dans « Les packs précédents ».",
              confirmLabel: "Publier",
            })}
          >
            <Send aria-hidden className="size-4" />
            Publier
          </button>
        )}
        {status === "published" && (
          <>
            <button
              type="submit"
              name="status"
              value="draft"
              disabled={pending}
              className={secondaryButton}
              onClick={confirmThen({
                title: "Repasser en brouillon ?",
                message: "Le pack quitte la page Mail Club publique. Vous pourrez le republier.",
                confirmLabel: "Repasser en brouillon",
              })}
            >
              <Undo2 aria-hidden className="size-4" />
              Repasser en brouillon
            </button>
            <Link href="/infos/mail-club" className={secondaryButton}>
              <ExternalLink aria-hidden className="size-4" />
              Voir la page Mail Club
            </Link>
          </>
        )}
      </div>
    </form>
  );
}
