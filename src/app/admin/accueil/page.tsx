import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, formatDate } from "@/components/account/ui";
import { AdminHeader } from "@/components/admin/catalog/shared";
import { HomeCarouselsForm } from "@/components/admin/home/HomeCarouselsForm";
import { requireAdmin } from "@/lib/auth/dal";
import { catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { homeAdminOptions } from "@/lib/home/admin-options";
import { codeCarousels } from "@/lib/home/carousels";
import { readHomeCarousels } from "@/lib/home/repository";

export const metadata: Metadata = { title: "Accueil" };

async function HomeContent() {
  await requireAdmin();
  const open = catalogAdminEnabled(process.env);
  const header = <AdminHeader title="Accueil" back={{ href: "/admin", label: "Administration" }} />;
  if (!open) {
    return (
      <>
        {header}
        <div className="mt-8">
          <Card title="Lecture seule">
            <p className="text-ink-muted">L&apos;administration n&apos;est pas ouverte ici : les carrousels de l&apos;accueil se modifient sur dourya.fr.</p>
          </Card>
        </div>
      </>
    );
  }
  const [stored, options] = await Promise.all([readHomeCarousels(), homeAdminOptions()]);
  return (
    <>
      {header}
      <div className="mt-8 space-y-6">
        <Card title="Comment ça marche">
          <p className="text-ink-muted">
            Composez les deux carrousels de la page d&apos;accueil : un titre, un sous-titre, une photo de produit et un lien par diapo. Une diapo n&apos;apparaît que si elle est
            active et que sa rubrique ou son produit est visible dans la boutique (une photo ajoutée au catalogue n&apos;apparaît que tant que son produit est en vente).
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Dernier enregistrement : {stored?.updatedAt ? formatDate(stored.updatedAt) : "jamais (contenu d'origine du site)"}.
          </p>
        </Card>
        <HomeCarouselsForm initial={stored?.carousels ?? codeCarousels()} options={options} stored={!!stored} />
      </div>
    </>
  );
}

export default function HomeAdminPage() {
  return (
    <Suspense fallback={<p role="status" className="text-ink-muted">Chargement…</p>}>
      <HomeContent />
    </Suspense>
  );
}
