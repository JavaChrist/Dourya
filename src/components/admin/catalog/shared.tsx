import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Notice } from "@/components/auth/FormParts";
import type { CatalogAdminMode, CatalogAdminState } from "@/lib/catalog/admin-gate";

export const textareaClass =
  "mt-1.5 min-h-28 w-full rounded-2xl border-2 border-secondary/40 bg-white px-4 py-3 text-base text-ink focus:border-ink focus:outline-none aria-[invalid=true]:border-pink-strong";
export const selectClass =
  "mt-1.5 h-11 w-full rounded-full border-2 border-secondary/40 bg-white px-4 text-base text-ink focus:border-ink focus:outline-none";
export const labelClass = "block text-sm font-bold text-ink";

export const ICON_LABEL = { print: "Print", sticker: "Sticker", keychain: "Porte-clés", headband: "Headband", sparkles: "Étoiles" } as const;
export const STATUS_LABEL = { draft: "Brouillon", published: "Publié", archived: "Archivé" } as const;

export function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="mt-1 text-sm font-bold text-pink-strong">
      {error}
    </p>
  );
}

export function AdminHeader({ title, back, children }: { title: string; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && (
          <Link href={back.href} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink">
            <ArrowLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="mt-1 font-display text-4xl font-semibold text-pink-strong">{title}</h1>
      </div>
      {children}
    </div>
  );
}

const REASON = {
  "not-test-preview": "L'administration du catalogue est disponible sur dourya.fr et sur la préversion stripe-test (base dourya-test), pas sur ce déploiement.",
  database: "La base de test dourya-test n'est pas configurée pour cette préversion : aucune écriture n'est possible.",
  bucket: "Le stockage des photos n'est pas configuré pour ce déploiement : aucune écriture n'est possible.",
} as const;

export function CatalogClosed({ state }: { state: Extract<CatalogAdminState, { enabled: false }> }) {
  return (
    <div className="mt-8">
      <Notice tone="info">{REASON[state.reason]} Le catalogue de dourya.fr reste celui du code.</Notice>
    </div>
  );
}

export function DraftOnlyNotice({ mode }: { mode: CatalogAdminMode }) {
  return (
    <Notice tone="info">
      {mode === "production" ? (
        <>
          Une <strong>nouvelle rubrique visible</strong> apparaît tout de suite dans la boutique (filtres, page de la rubrique, accueil, sitemap), même vide. Les fiches préparées ici restent <strong>privées</strong> : visibles uniquement dans cette administration, jamais dans la boutique publique, le panier ni le sitemap. Les photos ne sont accessibles qu&apos;aux comptes administrateurs. La publication et la vente restent fermées.
        </>
      ) : (
        <>
          Les fiches restent en <strong>brouillon</strong> : visibles uniquement sur cette préversion, jamais dans le panier, le sitemap ni la boutique publique. La vente reste fermée.
        </>
      )}
    </Notice>
  );
}
