import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/account/ui";
import { ProductForm } from "@/components/admin/catalog/ProductForm";
import { AdminHeader, CatalogClosed, DraftOnlyNotice } from "@/components/admin/catalog/shared";
import { requireAdmin } from "@/lib/auth/dal";
import { catalogAdminState } from "@/lib/catalog/admin-gate";
import { adminCatalog } from "@/lib/catalog/admin-repository";

export const metadata: Metadata = { title: "Nouvelle fiche" };

async function Content() {
  await requireAdmin();
  const state = catalogAdminState(process.env);
  if (!state.enabled) return <CatalogClosed state={state} />;
  const { categories } = await adminCatalog();
  return (
    <div className="mt-8 space-y-6">
      <DraftOnlyNotice mode={state.mode} />
      <Card title="Fiche">
        <ProductForm categories={categories} />
      </Card>
      <p className="text-sm text-ink-muted">Les photos s&apos;ajoutent juste après la création de la fiche.</p>
    </div>
  );
}

export default function NewProductPage() {
  return (
    <>
      <AdminHeader title="Nouvelle fiche" back={{ href: "/admin/catalogue/produits", label: "Fiches produits" }} />
      <Suspense fallback={<p role="status" className="mt-8 text-ink-muted">Chargement…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
