import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/account/ui";
import { AdminHeader, CatalogClosed } from "@/components/admin/catalog/shared";
import { PackPhotoManager } from "@/components/admin/mail-club/PackPhotoManager";
import { PackPublishPanel } from "@/components/admin/mail-club/PackPublishPanel";
import { PackTextForm } from "@/components/admin/mail-club/PackTextForm";
import { Notice } from "@/components/auth/FormParts";
import { requireAdmin } from "@/lib/auth/dal";
import { catalogAdminState } from "@/lib/catalog/admin-gate";
import { MAX_PACK_IMAGES, PACK_ID_PATTERN, PACK_MISSING_LABEL, packMonthLabel, packReadiness, splitPublished } from "@/lib/subscriptions/packs";
import { listPacks } from "@/lib/subscriptions/packs-repository";

export const metadata: Metadata = { title: "Pack du mois" };

async function Content({ params, searchParams }: PageProps<"/admin/mail-club/packs/[id]">) {
  await requireAdmin();
  const state = catalogAdminState(process.env);
  if (!state.enabled) return <CatalogClosed state={state} />;
  const { id } = await params;
  if (!PACK_ID_PATTERN.test(id)) notFound();
  const packs = await listPacks();
  const pack = packs.find((p) => p.id === id);
  if (!pack) notFound();
  const created = (await searchParams).cree === "1";
  const missing = packReadiness(pack).map((m) => PACK_MISSING_LABEL[m]);
  const monthLabel = packMonthLabel(pack.id);
  return (
    <div className="mt-8 space-y-6">
      {created && <Notice tone="success">Fiche créée en brouillon. Ajoutez ses photos et sa description, puis publiez-la.</Notice>}
      <h2 className="font-display text-2xl font-semibold text-ink">
        {monthLabel} · {pack.title}
      </h2>
      <Card title="Publication">
        <PackPublishPanel packId={pack.id} monthLabel={monthLabel} status={pack.status} missing={missing} isCurrent={splitPublished(packs).current?.id === pack.id} />
      </Card>
      <Card title="Photos">
        <PackPhotoManager packId={pack.id} title={pack.title} images={pack.images} max={MAX_PACK_IMAGES} />
      </Card>
      <Card title="Texte">
        <PackTextForm packId={pack.id} title={pack.title} description={pack.description} />
      </Card>
    </div>
  );
}

export default function PackAdminPage(props: PageProps<"/admin/mail-club/packs/[id]">) {
  return (
    <>
      <AdminHeader title="Pack du mois" back={{ href: "/admin/mail-club", label: "Mail Club" }} />
      <Suspense fallback={<p role="status" className="mt-8 text-ink-muted">Chargement…</p>}>
        <Content {...props} />
      </Suspense>
    </>
  );
}
