import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCategory, getShownProducts, getVisibleCategories, getVisibleCollections } from "@/lib/catalog";
import { parseShopParams } from "@/lib/catalog/query";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ListingFallback, ListingHero } from "@/components/catalog/ListingHero";
import { ShopListing } from "@/components/catalog/ShopListing";
import { slugParams } from "@/lib/catalog/static-params";

export async function generateStaticParams() {
  return slugParams((await getVisibleCategories()).map((c) => c.slug));
}

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  if (!category) return { title: "Catégorie introuvable" };
  return {
    title: category.seo?.title ?? category.name,
    description: category.seo?.description ?? category.description,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

async function CategoryContent({ params, searchParams }: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  const [query, products, collections] = await Promise.all([
    searchParams.then(parseShopParams),
    getShownProducts(),
    getVisibleCollections(),
  ]);

  return (
    <>
      <ListingHero
        title={category.name}
        description={category.description}
        icon={<CategoryIcon name={category.icon} className="size-8 text-pink-strong sm:size-9" />}
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <ShopListing
          basePath={`/categories/${category.slug}`}
          products={products}
          query={query}
          collections={collections}
          fixed={{ category: category.slug }}
        />
      </div>
    </>
  );
}

/** params are read inside Suspense so the App Shell stays URL-independent (Next 16 partial prefetching). */
export default function CategoryPage(props: PageProps<"/categories/[slug]">) {
  return (
    <Suspense fallback={<ListingFallback />}>
      <CategoryContent {...props} />
    </Suspense>
  );
}
