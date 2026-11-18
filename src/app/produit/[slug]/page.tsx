import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice, getCategory, getProduct, getProducts } from "@/lib/catalog";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { SlideVisual } from "@/components/ui/SlideVisual";

export function generateStaticParams() {
  return getProducts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/produit/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: getProduct(slug)?.name ?? "Produit" };
}

/** Product page skeleton. Variants, add to cart and stock arrive in Lot 2. */
async function ProductContent({ params }: { params: PageProps<"/produit/[slug]">["params"] }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  const category = getCategory(product.categorySlug);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-lg">
        <SlideVisual
          slide={{ id: product.slug, title: product.name, image: product.image, isDemo: product.isDemo, background: { kind: "sparkle" } }}
          sizes="(max-width: 768px) 100vw, 560px"
          priority
        />
      </div>
      <div>
        {category && (
          <Link href={`/categorie/${category.slug}`} className="text-sm font-bold text-link hover:underline">
            {category.name}
          </Link>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl font-semibold text-ink">{product.name}</h1>
          {product.isDemo && <DemoBadge />}
        </div>
        <p className="mt-3 text-lg text-ink-muted">{product.description}</p>
        <h2 className="mt-6 font-display text-xl font-semibold text-pink-strong">Formats</h2>
        <ul className="mt-2 space-y-2">
          {product.variants.map((v) => (
            <li key={v.id} className="flex justify-between rounded-md bg-surface-muted px-4 py-3">
              <span className="font-semibold">{v.name}</span>
              <span className="text-ink-muted">{formatPrice(v.priceCents)}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled
          className="mt-6 min-h-11 w-full cursor-not-allowed rounded-full bg-ink/10 px-6 font-display text-lg font-semibold text-ink/60"
        >
          Ajout au panier disponible au lot 2
        </button>
      </div>
    </div>
  );
}

/** params are read inside Suspense so the shared App Shell stays URL-independent (Next 16 partial prefetching). */
export default function ProductPage({ params }: PageProps<"/produit/[slug]">) {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-[60vh]" />}>
      <ProductContent params={params} />
    </Suspense>
  );
}
