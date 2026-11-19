import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, Info, Truck } from "lucide-react";
import { commerceConfig, priceMention } from "@/config/commerce";
import { getShownProducts, getProductForPage, getVisibleCategories } from "@/lib/catalog";
import { availableStock, productPageState, variantAvailability } from "@/lib/catalog/visibility";
import { productVisuals } from "@/lib/catalog/visuals";
import type { Product, ProductVariant } from "@/lib/types";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { DraftBadge } from "@/components/ui/DraftBadge";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { AddToCart, type PersonalisationOption, type VariantOption } from "@/components/catalog/AddToCart";

export async function generateStaticParams() {
  return (await getShownProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/produits/[slug]">): Promise<Metadata> {
  const product = await getProductForPage((await params).slug);
  if (!product) return { title: "Produit introuvable" };
  return {
    title: product.seo?.title ?? product.name,
    description: product.seo?.description ?? product.description,
    alternates: { canonical: `/produits/${product.slug}` },
    ...(product.status === "draft" && { robots: { index: false, follow: false } }),
  };
}

function availabilityNote(v: ProductVariant): string | undefined {
  const a = variantAvailability(v);
  switch (a.kind) {
    case "made_to_order":
      return "Fabriqué à la demande";
    case "in_stock":
      return a.low ? `Plus que ${a.stock} en stock` : "En stock";
    case "out_of_stock":
      return "Rupture de stock";
    case "no_price":
      return "Prix à venir";
    default:
      return undefined;
  }
}

function variantOptions(product: Product): VariantOption[] {
  const cap = product.maxQuantityPerLine ?? commerceConfig.maxQuantityPerLine;
  return product.variants
    .filter((v) => v.active)
    .map((v) => {
      const a = variantAvailability(v);
      return {
        id: v.id,
        name: v.name,
        priceCents: v.priceCents,
        note: availabilityNote(v),
        purchasable: product.status === "published" && (a.kind === "made_to_order" || a.kind === "in_stock"),
        maxQuantity: Math.min(cap, availableStock(v) ?? Infinity),
      };
    });
}

/** The availability window is checked in the browser (current date) and again by the server when pricing. */
function personalisationOption(product: Product): PersonalisationOption | undefined {
  const config = product.personalisation;
  if (!config?.enabled) return undefined;
  return {
    label: config.label,
    maxLength: config.maxLength,
    surchargeCents: config.surchargeCents,
    instructions: config.instructions,
    variantIds: config.variantIds,
    availableFrom: config.availableFrom,
    availableUntil: config.availableUntil,
  };
}

async function ProductContent({ params }: { params: PageProps<"/produits/[slug]">["params"] }) {
  const { slug } = await params;
  const product = await getProductForPage(slug);
  if (!product) notFound();
  const categories = await getVisibleCategories();
  const category = categories.find((c) => product.categorySlugs.includes(c.slug));
  const state = productPageState(product);
  const mention = priceMention();

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-10 md:grid-cols-2 lg:gap-12">
      <ProductGallery slides={productVisuals(product)} name={product.name} />
      <div>
        <nav aria-label="Fil d'Ariane" className="text-sm">
          <Link href="/boutique" className="font-bold text-link hover:underline">
            Boutique
          </Link>
          {category && (
            <>
              <span aria-hidden className="mx-1.5 text-ink-muted">/</span>
              <Link href={`/categories/${category.slug}`} className="font-bold text-link hover:underline">
                {category.name}
              </Link>
            </>
          )}
        </nav>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl font-semibold text-ink">{product.name}</h1>
          {product.isDemo && <DemoBadge />}
          {product.status === "draft" && <DraftBadge />}
        </div>
        {product.description && <p className="mt-3 text-lg text-ink-muted">{product.description}</p>}

        {product.status === "draft" && (
          <p className="mt-4 flex gap-2 rounded-md border-2 border-dashed border-ink/40 px-4 py-3 text-sm text-ink" role="note">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            Brouillon visible sur la préversion seulement : prix, stock et regroupement à valider avant publication.
          </p>
        )}

        {product.isDemo && (
          <p className="mt-4 flex gap-2 rounded-md bg-accent/40 px-4 py-3 text-sm text-ink">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            Produit de démonstration : les prix sont fictifs et aucune commande n&apos;est possible.
          </p>
        )}

        {state === "archived" ? (
          <p className="mt-6 flex items-center gap-3 rounded-md bg-surface-muted px-4 py-4 font-semibold text-ink" role="status">
            <Archive aria-hidden className="size-5 text-pink-strong" />
            Ce produit n&apos;est plus vendu.
            <Link href="/boutique" className="ml-auto font-bold text-link hover:underline">
              Voir la boutique
            </Link>
          </p>
        ) : (
          <AddToCart productId={product.id} productName={product.name} variants={variantOptions(product)} personalisation={personalisationOption(product)} />
        )}

        {mention && <p className="mt-3 text-sm text-ink-muted">Prix {mention}.</p>}

        <div className="mt-6 flex gap-3 rounded-md border-2 border-secondary/30 px-4 py-3 text-sm text-ink">
          <Truck aria-hidden className="mt-0.5 size-5 shrink-0 text-pink-strong" />
          <p>
            <span className="font-bold">Livraison :</span> les frais et délais seront calculés avant le paiement.{" "}
            <Link href="/infos/livraison-retours" className="font-bold text-link hover:underline">
              Livraison et retours
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/** params are read inside Suspense so the App Shell stays URL-independent (Next 16 partial prefetching). */
export default function ProductPage({ params }: PageProps<"/produits/[slug]">) {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-[70vh]" />}>
      <ProductContent params={params} />
    </Suspense>
  );
}
