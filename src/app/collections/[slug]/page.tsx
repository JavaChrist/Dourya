import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getCollection, getShownProducts, getVisibleCategories, getVisibleCollections } from "@/lib/catalog";
import { parseShopParams } from "@/lib/catalog/query";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { ListingFallback, ListingHero } from "@/components/catalog/ListingHero";
import { ShopListing } from "@/components/catalog/ShopListing";

export async function generateStaticParams() {
  return (await getVisibleCollections()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const collection = await getCollection((await params).slug);
  if (!collection) return { title: "Collection introuvable" };
  return {
    title: collection.seo?.title ?? collection.name,
    description: collection.seo?.description ?? collection.description,
    alternates: { canonical: `/collections/${collection.slug}` },
  };
}

async function CollectionContent({ params, searchParams }: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) notFound();
  const [query, products, categories] = await Promise.all([
    searchParams.then(parseShopParams),
    getShownProducts(),
    getVisibleCategories(),
  ]);

  return (
    <>
      <ListingHero
        title={collection.name}
        description={collection.description}
        icon={<Sparkles aria-hidden className="size-8 text-pink-strong sm:size-9" />}
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {collection.isDemo && (
          <p className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
            <DemoBadge /> Collection de démonstration.
          </p>
        )}
        <ShopListing
          basePath={`/collections/${collection.slug}`}
          products={products}
          query={query}
          categories={categories}
          fixed={{ collection: collection.slug }}
        />
      </div>
    </>
  );
}

/** params are read inside Suspense so the App Shell stays URL-independent (Next 16 partial prefetching). */
export default function CollectionPage(props: PageProps<"/collections/[slug]">) {
  return (
    <Suspense fallback={<ListingFallback />}>
      <CollectionContent {...props} />
    </Suspense>
  );
}
