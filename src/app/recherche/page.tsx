import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getProducts, getVisibleCategories } from "@/lib/catalog";

export const metadata: Metadata = { title: "Recherche" };

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function searchEntries() {
  const cats = getVisibleCategories();
  const catName = Object.fromEntries(cats.map((c) => [c.slug, c.name]));
  return [
    ...cats.map((c) => ({ label: c.name, href: `/categorie/${c.slug}`, hint: "Catégorie" })),
    ...getProducts().map((p) => ({ label: p.name, href: `/produit/${p.slug}`, hint: catName[p.categorySlug] ?? "" })),
  ];
}

/** Reads searchParams inside Suspense so the App Shell stays URL-independent. */
async function Results({ searchParams }: { searchParams: PageProps<"/recherche">["searchParams"] }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();
  const results = q ? searchEntries().filter((e) => normalize(e.label).includes(normalize(q))) : [];

  return (
    <div className="mt-6">
      <p className="text-ink-muted" role="status">
        {q ? `${results.length} résultat${results.length > 1 ? "s" : ""} pour « ${q} »` : "Saisissez un terme de recherche."}
      </p>
      {results.length > 0 && (
        <ul className="mt-4 divide-y divide-secondary/30 rounded-md bg-surface-muted">
          {results.map((r) => (
            <li key={r.href}>
              <Link href={r.href} className="flex justify-between gap-3 px-4 py-3 hover:bg-white">
                <span className="font-semibold">{r.label}</span>
                <span className="text-sm text-ink-muted">{r.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/recherche">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-pink-strong">Recherche</h1>
      <Suspense fallback={<p className="mt-6 text-ink-muted">Chargement…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
