"use client";

import Link from "next/link";
import { Pause, Play, Sparkles } from "lucide-react";
import { Fragment, useState } from "react";
import type { PromoBannerConfig, PromoMessage } from "@/lib/types";

/**
 * Scrolling promo banner. The list is rendered twice for a seamless loop; the
 * copy is hidden from assistive tech and keyboard. Pauses on hover/focus, has
 * an explicit pause button, and stops under prefers-reduced-motion (CSS).
 */
export function PromoBanner({ config }: { config: PromoBannerConfig }) {
  const [paused, setPaused] = useState(false);
  if (!config.enabled || config.messages.length === 0) return null;

  // Repeat short lists so one copy is always wider than the screen.
  const repeat = Math.max(1, Math.ceil(6 / config.messages.length));
  const items = Array.from({ length: repeat }, () => config.messages).flat();

  return (
    <div
      className="marquee relative flex items-center overflow-hidden bg-accent text-ink"
      data-paused={paused}
      style={{ ["--marquee-duration" as string]: `${config.durationSeconds}s` }}
    >
      <h2 className="sr-only">Informations et promotions</h2>
      <div className="flex min-w-0 flex-1 overflow-hidden motion-reduce:overflow-x-auto">
        <div className="marquee-track flex w-max shrink-0">
          <MessageList items={items} />
          <MessageList items={items} hidden />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? "Reprendre le défilement" : "Mettre en pause le défilement"}
        className="z-10 flex size-10 shrink-0 items-center justify-center bg-accent hover:bg-black/5 motion-reduce:hidden"
      >
        {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
      </button>
    </div>
  );
}

function MessageList({ items, hidden = false }: { items: PromoMessage[]; hidden?: boolean }) {
  const unique = new Set(items.map((m) => m.id)).size;
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((m, i) => {
        // Only the first occurrence of each message is read and focusable.
        const duplicate = hidden || i >= unique;
        return (
        <Fragment key={`${m.id}-${i}`}>
          <li
            aria-hidden={duplicate || undefined}
            className="flex items-center px-6 py-2 text-sm font-bold whitespace-nowrap sm:text-base"
          >
            {m.link ? (
              <Link
                href={m.link.href}
                tabIndex={duplicate ? -1 : undefined}
                className="underline decoration-2 underline-offset-4 hover:decoration-primary"
              >
                {m.text}
              </Link>
            ) : (
              m.text
            )}
          </li>
          <li aria-hidden className="flex items-center text-primary">
            <Sparkles className="size-4" />
          </li>
        </Fragment>
        );
      })}
    </ul>
  );
}
