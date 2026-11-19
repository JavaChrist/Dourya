import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { primaryButton } from "@/components/account/ui";
import { AdminHeader, CatalogClosed, DraftOnlyNotice, STATUS_LABEL } from "@/components/admin/catalog/shared";
import { requireAdmin } from "@/lib/auth/dal";
import { catalogAdminState } from "@/lib/catalog/admin-gate";
import { adminCatalog } from "@/lib/catalog/admin-repository";
import { isDraftPhotoUrl } from "@/lib/catalog/draft-photo-url";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Fiches produits" };

async function Content() {
  await requireAdmin();
  const state = catalogAdminState(process.env);
  if (!state.enabled) return <CatalogClosed state={state} />;
  const { products, storedProductIds } = await adminCatalog();
  const real = products.filter((p) => !p.isDemo);
  return (
    <div className="mt-8 space-y-6">
      <DraftOnlyNotice mode={state.mode} />
      <ul className="divide-y divide-secondary/30 rounded-lg bg-white ring-1 ring-secondary/30">
        {real.map((p) => {
          const cover = p.images[0];
          const prices = p.variants.map((v) => v.priceCents).filter((c): c is number => c !== null);
          return (
            <li key={p.id}>
              <Link href={`/admin/catalogue/produits/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                  {cover && <Image src={cover.src} alt="" fill sizes="56px" className="object-cover" unoptimized={isDraftPhotoUrl(cover.src)} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{p.name}</p>
                  <p className="text-sm text-ink-muted">
                    {STATUS_LABEL[p.status]} · {prices.length ? formatPrice(Math.min(...prices)) : "prix à fixer"} · {p.images.length} photo(s)
                    {storedProductIds.has(p.id) ? "" : " · pas encore importée"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <>
      <AdminHeader title="Fiches produits" back={{ href: "/admin/catalogue", label: "Catalogue" }}>
        <Link href="/admin/catalogue/produits/nouveau" className={primaryButton}>
          <Plus aria-hidden className="size-5" />
          Nouvelle fiche
        </Link>
      </AdminHeader>
      <Suspense fallback={<p role="status" className="mt-8 text-ink-muted">Chargement…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
