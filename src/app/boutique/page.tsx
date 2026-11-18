import type { Metadata } from "next";
import { Suspense } from "react";
import { getListedProducts, getVisibleCategories, getVisibleCollections } from "@/lib/catalog";
import { parseShopParams } from "@/lib/catalog/query";
import { ListingFallback, ListingHero } from "@/components/catalog/ListingHero";
import { ShopListing } from "@/components/catalog/ShopListing";

export const metadata: Metadata = {
  title: "Boutique",
  description: "Toutes les créations DOURYA : prints, stickers et porte-clés.",
};

/** searchParams are read inside Suspense so the App Shell stays URL-independent. */
async function Listing({ searchParams }: { searchParams: PageProps<"/boutique">["searchParams"] }) {
  const [query, products, categories, collections] = await Promise.all([
    searchParams.then(parseShopParams),
    getListedProducts(),
    getVisibleCategories(),
    getVisibleCollections(),
  ]);
  return (
    <ShopListing basePath="/boutique" products={products} query={query} categories={categories} collections={collections} />
  );
}

export default function ShopPage({ searchParams }: PageProps<"/boutique">) {
  return (
    <>
      <ListingHero title="Boutique" description="Toutes les créations, à filtrer par catégorie ou par collection." />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Suspense fallback={<ListingFallback />}>
          <Listing searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
