"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ManualCarouselConfig } from "@/lib/types";
import { Section } from "@/components/ui/Section";
import { SlideVisual } from "@/components/ui/SlideVisual";
import { DemoBadge } from "@/components/ui/DemoBadge";

/**
 * Manual carousel: native horizontal scroll with snap (touch swipe for free),
 * plus left/right arrows. Never rotates on its own.
 */
export function ManualCarousel({ config }: { config: ManualCarouselConfig }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector("li");
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  if (config.slides.length === 0) return null;

  return (
    <Section background={config.background} labelledBy="manual-carousel-title" className="py-12 sm:py-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="manual-carousel-title" className="font-display text-3xl font-semibold text-pink-strong sm:text-4xl">
            {config.title}
          </h2>
          {config.subtitle && <p className="mt-1 text-ink-muted">{config.subtitle}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <ArrowButton dir={-1} disabled={!canPrev} onClick={() => scroll(-1)} />
          <ArrowButton dir={1} disabled={!canNext} onClick={() => scroll(1)} />
        </div>
      </div>

      <ul
        ref={trackRef}
        onScroll={update}
        className="no-scrollbar -mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0"
      >
        {config.slides.map((slide) => {
          const card = (
            <>
              <div className="relative aspect-[4/5] overflow-hidden rounded-md">
                <SlideVisual slide={slide} sizes="(max-width: 640px) 75vw, 280px" className="transition duration-300 group-hover:scale-105" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <p className="font-display text-lg font-semibold text-ink">{slide.title}</p>
                {slide.isDemo && <DemoBadge />}
              </div>
            </>
          );
          return (
            <li key={slide.id} className="w-[72%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]">
              {slide.link ? (
                <Link href={slide.link.href} className="group block rounded-md">
                  {card}
                </Link>
              ) : (
                <div>{card}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function ArrowButton({ dir, disabled, onClick }: { dir: 1 | -1; disabled: boolean; onClick: () => void }) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 1 ? "Éléments suivants" : "Éléments précédents"}
      className="flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-[0_3px_0_rgba(43,18,32,0.25)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink/50 disabled:shadow-none"
    >
      <Icon aria-hidden className="size-6" />
    </button>
  );
}
