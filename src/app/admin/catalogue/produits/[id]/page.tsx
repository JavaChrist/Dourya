import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { Card, secondaryButton } from "@/components/account/ui";
import { PhotoManager } from "@/components/admin/catalog/PhotoManager";
import { ProductForm } from "@/components/admin/catalog/ProductForm";
import { AdminHeader, CatalogClosed, DraftOnlyNotice } from "@/components/admin/catalog/shared";
import { Notice } from "@/components/auth/FormParts";
import { requireAdmin } from "@/lib/auth/dal";
import { PRODUCT_ID_PATTERN, catalogAdminState } from "@/lib/catalog/admin-gate";
import { adminCatalog } from "@/lib/catalog/admin-repository";
import { MAX_IMAGES } from "@/lib/catalog/stored-schema";

export const metadata: Metadata = { title: "Fiche produit" };

async function Content({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string }> }) {
  await requireAdmin();
  const state = catalogAdminState(process.env);
  if (!state.enabled) return <CatalogClosed state={state} />;
  const { id } = await params;
  if (!PRODUCT_ID_PATTERN.test(id)) notFound();
  const { products, categories } = await adminCatalog();
  const product = products.find((p) => p.id === id);
  if (!product) notFound();
  if (product.isDemo)
    return (
      <div className="mt-8">
        <Notice tone="info">Produit de démonstration (tests de paiement) : il ne se modifie pas ici.</Notice>
      </div>
    );
  const created = (await searchParams).cree === "1";
  return (
    <div className="mt-8 space-y-6">
      {created && <Notice tone="success">Fiche créée en brouillon. Ajoutez ses photos ci-dessous.</Notice>}
      <DraftOnlyNotice />
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-semibold text-ink">{product.name}</h2>
        <Link href={`/produits/${product.slug}`} className={secondaryButton}>
          <ExternalLink aria-hidden className="size-4" />
          Voir la fiche
        </Link>
      </div>
      <Card title="Photos">
        <PhotoManager productId={product.id} productName={product.name} images={product.images} max={MAX_IMAGES} />
      </Card>
      <Card title="Informations">
        <ProductForm product={product} categories={categories} />
      </Card>
    </div>
  );
}

export default function ProductAdminPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string }> }) {
  return (
    <>
      <AdminHeader title="Fiche produit" back={{ href: "/admin/catalogue/produits", label: "Fiches produits" }} />
      <Suspense fallback={<p role="status" className="mt-8 text-ink-muted">Chargement…</p>}>
        <Content {...props} />
      </Suspense>
    </>
  );
}
