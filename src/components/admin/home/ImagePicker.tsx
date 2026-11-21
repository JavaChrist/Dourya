"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Check, Search, X } from "lucide-react";
import { inputClass } from "@/components/auth/FormParts";
import { isUploadedPhotoUrl } from "@/lib/catalog/draft-photo-url";
import type { ImageChoice } from "@/lib/home/carousels";

/** Thumbnail of a product photo (uploaded photos skip the optimizer: their route checks the session). */
export function Thumb({ choice, sizes }: { choice: ImageChoice; sizes: string }) {
  return <Image src={choice.preview} alt="" fill sizes={sizes} className="bg-white object-contain" unoptimized={isUploadedPhotoUrl(choice.preview)} />;
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Site-styled modal listing every product photo, grouped by product (then the
 * photo folders), with a search on the product name. `open` drives it.
 */
export function ImagePicker({
  open,
  images,
  selected,
  onPick,
  onClose,
}: {
  open: boolean;
  images: ImageChoice[];
  selected: string;
  onPick: (choice: ImageChoice) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);

  const groups = useMemo(() => {
    const q = normalize(query.trim());
    const out = new Map<string, ImageChoice[]>();
    for (const i of images) {
      if (q && !normalize(`${i.group} ${i.alt}`).includes(q)) continue;
      out.set(i.group, [...(out.get(i.group) ?? []), i]);
    }
    return [...out.entries()];
  }, [images, query]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="image-picker-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(56rem,calc(100vw-2rem))] rounded-lg bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/50"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e: MouseEvent<HTMLDialogElement>) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-center gap-3 border-b border-secondary/30 p-4 sm:p-5">
            <h2 id="image-picker-title" className="font-display text-2xl font-semibold">
              Choisir une photo
            </h2>
            <button type="button" onClick={onClose} aria-label="Fermer" className="ml-auto flex size-11 items-center justify-center rounded-full hover:bg-surface-muted">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="border-b border-secondary/30 px-4 pb-4 sm:px-5">
            <label className="relative block">
              <span className="sr-only">Chercher un produit</span>
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 mt-0.75 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Chercher un produit…"
                autoComplete="off"
                autoFocus
                className={`${inputClass} pl-10 pr-4 text-sm`}
              />
            </label>
          </div>
          <div className="overflow-y-auto p-4 sm:p-5">
            {groups.length === 0 && <p className="rounded-2xl bg-surface-muted p-4 text-ink-muted">Aucune photo ne correspond.</p>}
            <div className="space-y-6">
              {groups.map(([group, list]) => (
                <section key={group}>
                  <h3 className="text-sm font-bold text-ink">{group}</h3>
                  <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {list.map((choice) => {
                      const current = choice.src === selected;
                      return (
                        <li key={choice.src}>
                          <button
                            type="button"
                            onClick={() => onPick(choice)}
                            aria-pressed={current}
                            aria-label={`${choice.group}${choice.alt && choice.alt !== choice.group ? ` : ${choice.alt}` : ""}`}
                            className={`relative block aspect-square w-full overflow-hidden rounded-xl ring-2 transition ${current ? "ring-ink" : "ring-secondary/30 hover:ring-secondary"}`}
                          >
                            <Thumb choice={choice} sizes="(min-width: 640px) 160px, 30vw" />
                            {current && (
                              <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-ink text-white">
                                <Check aria-hidden className="size-4" />
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
