"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, CheckCircle2, CircleAlert, ExternalLink, Send, Undo2 } from "lucide-react";
import { setProductStatusAction } from "@/app/admin/catalogue/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage, primaryButton, secondaryButton } from "@/components/account/ui";
import type { PublishStatus } from "@/lib/types";
import { STATUS_LABEL } from "./shared";

const idle: FormState = { status: "idle" };

/**
 * Publication of a product. `missing` comes from publishReadiness() on the
 * server (and is checked again by the action): « Publier » stays disabled
 * while anything is missing.
 */
export function PublishPanel({ productId, slug, status, missing, blocked }: { productId: string; slug: string; status: PublishStatus; missing: string[]; blocked?: string }) {
  const [state, action, pending] = useActionState(setProductStatusAction, idle);
  const ready = missing.length === 0 && !blocked;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <FormMessage state={state} />
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
            onClick={(e) => {
              if (!window.confirm("Publier cette fiche ? Elle apparaîtra dans la boutique publique et dans le sitemap. La vente reste fermée.")) e.preventDefault();
            }}
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
            onClick={(e) => {
              if (!window.confirm("Archiver cette fiche ? Elle quitte la boutique ; vous pourrez la repasser en brouillon.")) e.preventDefault();
            }}
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
