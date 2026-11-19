import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/account/ui";
import { CategoryForm } from "@/components/admin/catalog/CategoryForm";
import { AdminHeader, CatalogClosed, ICON_LABEL } from "@/components/admin/catalog/shared";
import { requireAdmin } from "@/lib/auth/dal";
import { catalogAdminState } from "@/lib/catalog/admin-gate";
import { adminCatalog } from "@/lib/catalog/admin-repository";

export const metadata: Metadata = { title: "Rubriques" };

async function Content() {
  await requireAdmin();
  const state = catalogAdminState(process.env);
  if (!state.enabled) return <CatalogClosed state={state} />;
  const { categories, products } = await adminCatalog();
  return (
    <div className="mt-8 space-y-6">
      <Card title="Nouvelle rubrique">
        <CategoryForm />
      </Card>
      <Card title={`Rubriques (${categories.length})`}>
        <ul className="space-y-3">
          {categories.map((c) => (
            <li key={c.id}>
              <details className="rounded-2xl bg-surface-muted px-4 py-3">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 text-ink">
                  <span className="font-semibold">
                    {c.name} <span className="text-sm font-normal text-ink-muted">· {ICON_LABEL[c.icon]} · {products.filter((p) => p.categorySlugs.includes(c.slug)).length} fiche(s)</span>
                  </span>
                  <span className="text-sm text-ink-muted">{c.visible ? "Visible" : "Masquée"}</span>
                </summary>
                <div className="mt-4">
                  <CategoryForm category={c} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <>
      <AdminHeader title="Rubriques" back={{ href: "/admin/catalogue", label: "Catalogue" }} />
      <Suspense fallback={<p role="status" className="mt-8 text-ink-muted">Chargement…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
