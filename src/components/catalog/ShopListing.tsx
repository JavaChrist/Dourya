import Link from "next/link";
import { ChevronLeft, ChevronRight, PackageSearch, Search } from "lucide-react";
import type { Category, Collection, Product } from "@/lib/types";
import { SORTS, queryProducts, shopHref, type ShopQuery } from "@/lib/catalog/query";
import { ProductCard } from "./ProductCard";

const field =
  "h-11 w-full rounded-full border-2 border-secondary/40 bg-white px-4 text-base text-ink focus:border-ink focus:outline-none";

/**
 * Listing with search, filters, sort and pagination. A plain GET form:
 * it works without JavaScript and every state has its own URL.
 * `fixed` filters (category or collection pages) are not shown as fields.
 */
export function ShopListing({
  basePath,
  products,
  query,
  categories = [],
  collections = [],
  fixed = {},
}: {
  basePath: string;
  products: Product[];
  query: ShopQuery;
  categories?: Category[];
  collections?: Collection[];
  fixed?: { category?: string; collection?: string };
}) {
  // Unknown filter values are ignored rather than producing an empty page.
  const category = categories.some((c) => c.slug === query.category) ? query.category : undefined;
  const collection = collections.some((c) => c.slug === query.collection) ? query.collection : undefined;
  const effective: ShopQuery = { ...query, category, collection, ...fixed };
  const result = queryProducts(products, effective);
  const linkQuery: ShopQuery = { ...query, category, collection };
  const hasFilters = !!(query.q || category || collection);

  return (
    <div>
      <form action={basePath} method="get" role="search" className="grid gap-3 rounded-lg bg-surface-muted p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="mb-1 block text-sm font-bold text-ink">Rechercher</span>
          <input type="search" name="q" defaultValue={query.q} maxLength={80} placeholder="Nom d'un produit…" className={field} />
        </label>
        {!fixed.category && categories.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink">Catégorie</span>
            <select name="categorie" defaultValue={category ?? ""} className={field}>
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!fixed.collection && collections.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink">Collection</span>
            <select name="collection" defaultValue={collection ?? ""} className={field}>
              <option value="">Toutes</option>
              {collections.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-ink">Trier par</span>
          <select name="tri" defaultValue={query.sort ?? "nouveautes"} className={field}>
            {Object.entries(SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-button px-6 font-display text-lg font-semibold text-button-ink shadow-[0_3px_0_rgba(43,18,32,0.25)] hover:brightness-95"
        >
          <Search aria-hidden className="size-5" />
          Appliquer
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-ink-muted">
          {result.total} produit{result.total > 1 ? "s" : ""}
          {query.q ? ` pour « ${query.q} »` : ""}
        </p>
        {hasFilters && (
          <Link href={basePath} className="text-sm font-bold text-link hover:underline">
            Effacer les filtres
          </Link>
        )}
      </div>

      {result.items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-lg border-2 border-dashed border-secondary/50 px-6 py-12 text-center">
          <PackageSearch aria-hidden className="size-10 text-pink-strong" />
          <p className="mt-3 font-display text-xl font-semibold text-ink">{hasFilters ? "Aucun produit trouvé" : "Bientôt de nouvelles créations"}</p>
          <p className="mt-1 text-ink-muted">
            {hasFilters ? "Essayez une autre recherche ou retirez des filtres." : fixed?.category ? "Cette rubrique se remplit : revenez très vite." : "De nouvelles créations arrivent bientôt."}
          </p>
          {hasFilters && (
            <Link href={basePath} className="mt-4 font-bold text-link hover:underline">
              Voir tous les produits
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {result.items.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
          {result.page > 1 ? (
            <Link href={shopHref(basePath, { ...linkQuery, page: result.page - 1 })} className="flex size-11 items-center justify-center rounded-full bg-surface-muted hover:bg-secondary/30" aria-label="Page précédente">
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
          ) : (
            <span className="size-11" />
          )}
          {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={shopHref(basePath, { ...linkQuery, page: n })}
              aria-current={n === result.page ? "page" : undefined}
              className={`flex size-11 items-center justify-center rounded-full font-bold ${n === result.page ? "bg-primary text-white" : "bg-surface-muted hover:bg-secondary/30"}`}
            >
              {n}
            </Link>
          ))}
          {result.page < result.pageCount ? (
            <Link href={shopHref(basePath, { ...linkQuery, page: result.page + 1 })} className="flex size-11 items-center justify-center rounded-full bg-surface-muted hover:bg-secondary/30" aria-label="Page suivante">
              <ChevronRight aria-hidden className="size-5" />
            </Link>
          ) : (
            <span className="size-11" />
          )}
        </nav>
      )}
    </div>
  );
}
