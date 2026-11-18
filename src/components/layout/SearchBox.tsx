"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

export type SearchEntry = { label: string; href: string; hint: string };

/**
 * Product search. Lot 1: filters the demo catalogue in the browser.
 * Later: replaced by a Firestore / search-index query behind the same UI.
 */
export function SearchBox({
  entries,
  onNavigate,
  autoFocus = false,
  className = "",
}: {
  entries: SearchEntry[];
  onNavigate?: () => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return entries.filter((e) => normalize(e.label).includes(q)).slice(0, 6);
  }, [entries, query]);

  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        if (!q) return;
        setOpen(false);
        onNavigate?.();
        router.push(`/recherche?q=${encodeURIComponent(q)}`);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <label htmlFor={`${id}-q`} className="sr-only">
        Rechercher un produit
      </label>
      <input
        id={`${id}-q`}
        type="search"
        value={query}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder="Rechercher…"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={`${id}-results`}
        aria-expanded={open && results.length > 0}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="h-11 w-full rounded-full border-2 border-white/0 bg-white pr-12 pl-4 text-base text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Lancer la recherche"
        className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white hover:brightness-95"
      >
        <Search aria-hidden className="size-4" />
      </button>

      {open && results.length > 0 && (
        <ul
          id={`${id}-results`}
          className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-md bg-white py-1 text-ink shadow-xl ring-1 ring-black/5"
        >
          {results.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-muted focus-visible:bg-surface-muted"
              >
                <span className="font-semibold">{r.label}</span>
                <span className="text-sm text-ink-muted">{r.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
