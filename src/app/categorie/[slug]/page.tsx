import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice, getCategory, getProductsByCategory, getVisibleCategories } from "@/lib/catalog";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Section } from "@/components/ui/Section";
import { SlideVisual } from "@/components/ui/SlideVisual";

export function generateStaticParams() {
  return getVisibleCategories().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/categorie/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: getCategory(slug)?.name ?? "Catégorie" };
}

/** Category page skeleton. The full catalogue arrives in Lot 2. */
async function CategoryContent({ params }: { params: PageProps<"/categorie/[slug]">["params"] }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  const items = getProductsByCategory(slug);

  return (
    <>
      <Section background={{ kind: "grid" }} className="py-12">
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-full bg-white">
            <CategoryIcon name={category.icon} className="size-9 text-pink-strong" />
          </span>
          <h1 className="font-display text-4xl font-semibold text-white drop-shadow-[0_2px_0_rgba(43,18,32,0.35)] sm:text-5xl">
            {category.name}
          </h1>
        </div>
      </Section>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-ink-muted">Aperçu de la catégorie avec des produits de démonstration. Le catalogue complet arrive au lot 2.</p>
        {items.length === 0 ? (
          <p className="mt-6 text-ink">Aucun produit pour le moment.</p>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <li key={p.slug}>
                <Link href={`/produit/${p.slug}`} className="group block rounded-md">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-md">
                    <SlideVisual
                      slide={{ id: p.slug, title: p.name, image: p.image, isDemo: p.isDemo, background: { kind: "grid" } }}
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-display text-lg font-semibold text-ink">{p.name}</span>
                    {p.isDemo && <DemoBadge />}
                  </div>
                  <span className="text-sm text-ink-muted">{formatPrice(p.variants[0]?.priceCents ?? null)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** params are read inside Suspense so the shared App Shell stays URL-independent (Next 16 partial prefetching). */
export default function CategoryPage({ params }: PageProps<"/categorie/[slug]">) {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-[60vh]" />}>
      <CategoryContent params={params} />
    </Suspense>
  );
}
