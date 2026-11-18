"use client";

import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AutoCarouselConfig } from "@/lib/types";
import { SlideVisual } from "@/components/ui/SlideVisual";
import { DemoBadge } from "@/components/ui/DemoBadge";

/**
 * Automatic carousel: configurable speed, pagination, pause button, swipe.
 * Rotation stops while hovered/focused, when paused, and under reduced motion.
 */
export function HeroCarousel({ config }: { config: AutoCarouselConfig }) {
  const { slides, intervalMs } = config;
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const touchStart = useRef<number | null>(null);

  const count = slides.length;
  const playing = !userPaused && !reducedMotion && count > 1;
  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (!playing || interacting) return;
    const t = window.setTimeout(() => go(index + 1), intervalMs);
    return () => window.clearTimeout(t);
  }, [playing, interacting, index, intervalMs, go]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carrousel"
      aria-label={config.title ?? "À la une"}
      className="relative mx-auto w-full max-w-6xl px-0 sm:px-6 sm:pt-6"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setInteracting(false);
      }}
    >
      <div
        className="relative h-[clamp(22rem,62vh,34rem)] overflow-hidden sm:rounded-lg"
        onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStart.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
          touchStart.current = null;
        }}
      >
        <div
          className="flex h-full transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
          aria-live={playing && !interacting ? "off" : "polite"}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="diapositive"
              aria-label={`${i + 1} sur ${count} : ${slide.title}`}
              inert={i !== index}
              className="relative h-full w-full shrink-0"
            >
              <SlideVisual slide={slide} sizes="(max-width: 1152px) 100vw, 1152px" priority={i === 0} />
              <div className="absolute inset-x-0 bottom-0 flex items-end p-4 pb-14 sm:p-8 sm:pb-16">
                <div className="max-w-md rounded-md bg-white p-5 shadow-lg sm:p-6">
                  {slide.isDemo && <DemoBadge className="mb-2" />}
                  <h2 className="font-display text-3xl leading-tight font-semibold text-pink-strong sm:text-4xl">
                    {slide.title}
                  </h2>
                  {slide.subtitle && <p className="mt-2 text-ink-muted">{slide.subtitle}</p>}
                  {slide.link && (
                    <Link
                      href={slide.link.href}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-button px-5 py-2 font-display text-lg font-semibold text-button-ink shadow-[0_3px_0_rgba(43,18,32,0.25)] transition hover:-translate-y-0.5"
                    >
                      {slide.link.label ?? "Découvrir"}
                      <ArrowRight aria-hidden className="size-5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {count > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 shadow">
              {!reducedMotion && (
                <button
                  type="button"
                  onClick={() => setUserPaused((p) => !p)}
                  aria-label={userPaused ? "Lancer le défilement automatique" : "Mettre en pause le défilement automatique"}
                  className="flex size-8 items-center justify-center rounded-full text-ink hover:bg-surface-muted"
                >
                  {userPaused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
                </button>
              )}
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Afficher la diapositive ${i + 1} : ${slide.title}`}
                  aria-current={i === index ? "true" : undefined}
                  className="flex size-8 items-center justify-center rounded-full"
                >
                  <span
                    className={`block h-2.5 rounded-full transition-all ${
                      i === index ? "w-6 bg-primary" : "w-2.5 bg-ink/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
