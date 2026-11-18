"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID;
const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Detects a new deployment (app convention): compares this bundle's build id
 * with /api/version and opens a modal "Mettre à jour" / "Plus tard".
 */
export function UpdateNotifier() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dismissedFor = useRef<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !CURRENT) return;

    const check = async () => {
      if (dialogRef.current?.open) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (version && version !== CURRENT && version !== dismissedFor.current) {
          dismissedFor.current = version;
          dialogRef.current?.showModal();
        }
      } catch {
        // Offline or server unavailable: try again later.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="update-title"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg bg-white p-6 text-ink shadow-2xl backdrop:bg-ink/50"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent">
          <RefreshCw aria-hidden className="size-5" />
        </span>
        <h2 id="update-title" className="font-display text-2xl font-semibold">
          Nouvelle version disponible
        </h2>
      </div>
      <p className="mt-3 text-ink-muted">Une mise à jour de la boutique est disponible.</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="min-h-11 rounded-full px-5 font-semibold hover:bg-surface-muted"
        >
          Plus tard
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-full bg-button px-5 font-display text-lg font-semibold text-button-ink"
        >
          Mettre à jour
        </button>
      </div>
    </dialog>
  );
}
