"use client";

import Link from "next/link";
import { useActionState, type MouseEvent } from "react";
import { Archive, CheckCircle2, CircleAlert, ExternalLink, Send, Undo2 } from "lucide-react";
import { setProductStatusAction } from "@/app/admin/catalogue/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage, primaryButton, secondaryButton } from "@/components/account/ui";
import type { PublishStatus } from "@/lib/types";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { STATUS_LABEL } from "./shared";

const idle: FormState = { status: "idle" };

/**
 * Publication of a product. `missing` comes from publishReadiness() on the
 * server (and is checked again by the action): « Publier » stays disabled
 * while anything is missing.
 */
export function PublishPanel({ productId, slug, status, missing, blocked }: { productId: string; slug: string; status: PublishStatus; missing: string[]; blocked?: string }) {
  const [state, action, pending] = useActionState(setProductStatusAction, idle);
  const [ask, confirmDialog] = useConfirm();
  const ready = missing.length === 0 && !blocked;
  // The click is stopped, then the same button submits the form once the modal says yes.
  const confirmThen = (options: Parameters<typeof ask>[0]) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const button = e.currentTarget;
    void ask(options).then((ok) => {
      if (ok) button.form?.requestSubmit(button);
    });
  };
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <FormMessage state={state} />
      {confirmDialog}
      <p className="text-ink">
        Statut : <strong>{STATUS_LABEL[status]}</strong>
        {status === "published" && " · visible dans la boutique, la vente reste fermée"}
      </p>

      {blocked ? (
        <p className="flex items-start gap-2 text-ink-muted">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          {blocked}
        </p>
      ) : ready ? (
        <p className="flex items-center gap-2 font-semibold text-ink">
          <CheckCircle2 aria-hidden className="size-5 text-pink-strong" />
          Prêt à publier
        </p>
      ) : (
        <div>
          <p className="flex items-center gap-2 font-semibold text-ink">
            <CircleAlert aria-hidden className="size-5 text-pink-strong" />
            {status === "published" ? "Publiée mais masquée de la boutique : la fiche n'est plus complète." : "Avant de publier :"}
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
            className={`${primaryButton} disabled:cursor-not-allowed`}
            onClick={confirmThen({
              title: "Publier cette fiche ?",
              message: "Elle apparaîtra dans la boutique publique et dans le sitemap, avec ses photos. La vente reste fermée.",
              confirmLabel: "Publier",
            })}
          >
            <Send aria-hidden className="size-4" />
            Publier
          </button>
        )}
        {status !== "draft" && (
          <button type="submit" name="status" value="draft" disabled={pending} className={secondaryButton}>
            <Undo2 aria-hidden className="size-4" />
            Repasser en brouillon
          </button>
        )}
        {status !== "archived" && (
          <button
            type="submit"
            name="status"
            value="archived"
            disabled={pending}
            className={secondaryButton}
            onClick={confirmThen({
              title: "Archiver cette fiche ?",
              message: "Elle quitte la boutique. Vous pourrez la repasser en brouillon.",
              confirmLabel: "Archiver",
              tone: "danger",
            })}
          >
            <Archive aria-hidden className="size-4" />
            Archiver
          </button>
        )}
        {status === "published" && ready && (
          <Link href={`/produits/${slug}`} className={secondaryButton}>
            <ExternalLink aria-hidden className="size-4" />
            Voir dans la boutique
          </Link>
        )}
      </div>
    </form>
  );
}
