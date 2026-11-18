import type { Product } from "@/lib/types";
import { minPrice } from "./visibility";

export const SORTS = {
  nouveautes: "Nouveautés",
  "prix-croissant": "Prix croissant",
  "prix-decroissant": "Prix décroissant",
  nom: "Nom (A à Z)",
} as const;

export type SortKey = keyof typeof SORTS;

export type ShopQuery = {
  q?: string;
  category?: string;
  collection?: string;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
};

export type ShopResult = {
  items: Product[];
  total: number;
  page: number;
  pageCount: number;
};

/** Lowercase, accent-insensitive form used for search. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function isSortKey(v: string | undefined): v is SortKey {
  return !!v && v in SORTS;
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/**
 * Reads the shop URL parameters (?q=&categorie=&collection=&tri=&page=).
 * Untrusted input: lengths are capped and unknown values are dropped.
 */
export function parseShopParams(params: RawParams): ShopQuery {
  const sort = first(params.tri);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    q: first(params.q)?.slice(0, 80),
    category: first(params.categorie)?.slice(0, 100),
    collection: first(params.collection)?.slice(0, 100),
    sort: isSortKey(sort) ? sort : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Builds a shop URL keeping only the parameters that are set. */
export function shopHref(basePath: string, query: ShopQuery): string {
  const sp = new URLSearchParams();
  if (query.q) sp.set("q", query.q);
  if (query.category) sp.set("categorie", query.category);
  if (query.collection) sp.set("collection", query.collection);
  if (query.sort && query.sort !== "nouveautes") sp.set("tri", query.sort);
  if (query.page && query.page > 1) sp.set("page", String(query.page));
  const s = sp.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** Filters, sorts and paginates already-listed products. Pure, so it is unit-tested. */
export function queryProducts(products: Product[], query: ShopQuery): ShopResult {
  const q = query.q ? normalizeText(query.q.trim()) : "";
  let items = products.filter((p) => {
    if (query.category && !p.categorySlugs.includes(query.category)) return false;
    if (query.collection && !p.collectionSlugs.includes(query.collection)) return false;
    if (q && !normalizeText(`${p.name} ${p.description}`).includes(q)) return false;
    return true;
  });

  const sort = query.sort ?? "nouveautes";
  const priceOrInf = (p: Product, dir: 1 | -1) => minPrice(p) ?? (dir === 1 ? Infinity : -Infinity);
  items = [...items].sort((a, b) => {
    switch (sort) {
      case "prix-croissant":
        return priceOrInf(a, 1) - priceOrInf(b, 1);
      case "prix-decroissant":
        return priceOrInf(b, -1) - priceOrInf(a, -1);
      case "nom":
        return a.name.localeCompare(b.name, "fr");
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });

  const pageSize = Math.max(1, query.pageSize ?? 12);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1)), pageCount);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageCount,
  };
}
