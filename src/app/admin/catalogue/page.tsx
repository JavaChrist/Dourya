import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FolderTree, PackagePlus, Shapes } from "lucide-react";
import { AdminHeader, CatalogClosed, DraftOnlyNotice } from "@/components/admin/catalog/shared";
import { requireAdmin } from "@/lib/auth/dal";
import { catalogAdminState } from "@/lib/catalog/admin-gate";
import { adminCatalog } from "@/lib/catalog/admin-repository";

export const metadata: Metadata = { title: "Catalogue" };

const tile = "flex min-h-28 flex-col justify-between gap-3 rounded-lg bg-white p-5 ring-1 ring-secondary/30 transition hover:ring-ink";

async function Content() {
  await requireAdmin();
  const state = catalogAdminState(process.env);
  if (!state.enabled) return <CatalogClosed state={state} />;
  const { categories, products } = await adminCatalog();
  const real = products.filter((p) => !p.isDemo);
  return (
    <div className="mt-8 space-y-6">
      <DraftOnlyNotice />
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/catalogue/rubriques" className={tile}>
          <FolderTree aria-hidden className="size-6 text-pink-strong" />
          <span className="font-display text-xl font-semibold text-ink">Rubriques ({categories.length})</span>
        </Link>
        <Link href="/admin/catalogue/produits" className={tile}>
          <Shapes aria-hidden className="size-6 text-pink-strong" />
          <span className="font-display text-xl font-semibold text-ink">Fiches produits ({real.length})</span>
        </Link>
        <Link href="/admin/catalogue/produits/nouveau" className={tile}>
          <PackagePlus aria-hidden className="size-6 text-pink-strong" />
          <span className="font-display text-xl font-semibold text-ink">Nouvelle fiche</span>
        </Link>
      </div>
    </div>
  );
}

export default function CataloguePage() {
  return (
    <>
      <AdminHeader title="Catalogue" back={{ href: "/admin", label: "Administration" }} />
      <Suspense fallback={<p role="status" className="mt-8 text-ink-muted">Chargement…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
