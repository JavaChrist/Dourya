import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, formatDate } from "@/components/account/ui";
import { ShippingSettingsForm } from "@/components/admin/ShippingSettingsForm";
import { AdminHeader } from "@/components/admin/catalog/shared";
import { requireAdmin } from "@/lib/auth/dal";
import { catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { getShippingSettings, shippingSettingsUpdatedAt } from "@/lib/orders/repository";

export const metadata: Metadata = { title: "Expédition" };

async function ShippingContent() {
  await requireAdmin();
  const [settings, updatedAt] = await Promise.all([getShippingSettings(), shippingSettingsUpdatedAt()]);
  const open = catalogAdminEnabled(process.env);
  return (
    <>
      <AdminHeader title="Expédition" back={{ href: "/admin", label: "Administration" }} />
      <div className="mt-8 space-y-6">
        <Card title="Comment ça marche">
          <p className="text-ink-muted">
            Au panier, le client ne voit que les tarifs actifs d&apos;une zone ouverte dans lesquels son colis tient (poids des articles + emballage, épaisseur, longueur, largeur).
            Le moins cher apparaît en premier. Aucun prix n&apos;est proposé par défaut : sans tarif actif, la commande reste impossible. Le paiement reste fermé tant que vous ne
            l&apos;ouvrez pas.
          </p>
          <p className="mt-2 text-sm text-ink-muted">Dernier enregistrement : {updatedAt ? formatDate(updatedAt) : "jamais (réglages par défaut)"}.</p>
        </Card>
        {open ? (
          <ShippingSettingsForm settings={settings} />
        ) : (
          <Card title="Lecture seule">
            <p className="text-ink-muted">L&apos;administration n&apos;est pas ouverte ici : les réglages se modifient sur dourya.fr.</p>
          </Card>
        )}
      </div>
    </>
  );
}

export default function ShippingAdminPage() {
  return (
    <Suspense fallback={<p role="status" className="text-ink-muted">Chargement…</p>}>
      <ShippingContent />
    </Suspense>
  );
}
