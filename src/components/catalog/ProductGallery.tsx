"use client";

import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { useRef, useState } from "react";
import type { Slide } from "@/lib/types";
import { SlideVisual } from "@/components/ui/SlideVisual";

const roundButton =
  "flex size-11 items-center justify-center rounded-full bg-white/95 text-ink shadow-md transition hover:bg-white";

/** Multi-image gallery: thumbnails, and a zoom view in a native modal dialog (focus trap and Escape built in). */
export function ProductGallery({ slides, name }: { slides: Slide[]; name: string }) {
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const current = slides[index] ?? slides[0];
  const many = slides.length > 1;
  const go = (delta: number) => setIndex((i) => (i + delta + slides.length) % slides.length);

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-lg shadow-[0_6px_0_rgba(43,18,32,0.14)]">
        <SlideVisual slide={current} sizes="(max-width: 768px) 100vw, 560px" priority />
        <button
          type="button"
          className={`${roundButton} absolute right-3 bottom-3`}
          aria-label={`Agrandir le visuel ${index + 1} sur ${slides.length}`}
          aria-haspopup="dialog"
          onClick={() => dialogRef.current?.showModal()}
        >
          <ZoomIn aria-hidden className="size-5" />
        </button>
      </div>

      {many && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={`Visuels de ${name}`}>
          {slides.map((s, i) => (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Visuel ${i + 1} sur ${slides.length}`}
                aria-pressed={i === index}
                className={`relative block size-16 overflow-hidden rounded-md ring-offset-2 sm:size-20 ${i === index ? "ring-3 ring-primary" : "opacity-80 hover:opacity-100"}`}
              >
                <SlideVisual slide={{ ...s, isDemo: false }} sizes="80px" className="[&>div]:hidden" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        aria-label={`Zoom : ${name}`}
        className="m-auto h-[min(92dvh,92vw)] max-h-none w-[min(92dvh,92vw)] max-w-none overflow-hidden rounded-lg bg-white p-0 backdrop:bg-ink/70"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="relative size-full">
          {/* The demo badge is shown on the main visual; hidden here so it never covers the close button. */}
          <SlideVisual slide={{ ...current, isDemo: false }} sizes="92vw" />
          <button type="button" className={`${roundButton} absolute top-3 right-3`} aria-label="Fermer le zoom" onClick={() => dialogRef.current?.close()}>
            <X aria-hidden className="size-5" />
          </button>
          {many && (
            <>
              <button type="button" className={`${roundButton} absolute top-1/2 left-3 -translate-y-1/2`} aria-label="Visuel précédent" onClick={() => go(-1)}>
                <ChevronLeft aria-hidden className="size-6" />
              </button>
              <button type="button" className={`${roundButton} absolute top-1/2 right-3 -translate-y-1/2`} aria-label="Visuel suivant" onClick={() => go(1)}>
                <ChevronRight aria-hidden className="size-6" />
              </button>
              <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-sm font-bold text-ink" aria-live="polite">
                {index + 1} / {slides.length}
              </p>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
