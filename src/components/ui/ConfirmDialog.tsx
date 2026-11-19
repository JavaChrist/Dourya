"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

export type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive actions (delete, archive) get the pink-strong button. */
  tone?: "default" | "danger";
};

/**
 * Site-styled confirmation modal (never window.confirm). Returns `ask`, which
 * opens the modal and resolves true/false, and the element to render once.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    if (dialogRef.current?.open) dialogRef.current.close();
  }, []);

  const ask = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  useEffect(() => {
    if (options && resolver.current && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [options]);

  // A pending question is answered « non » if the component unmounts.
  useEffect(() => () => resolver.current?.(false), []);

  const danger = options?.tone === "danger";
  const Icon = danger ? AlertTriangle : HelpCircle;
  const element = (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg bg-white p-6 text-ink shadow-2xl backdrop:bg-ink/50"
      onCancel={() => finish(false)}
      onClick={(e: MouseEvent<HTMLDialogElement>) => {
        if (e.target === e.currentTarget) finish(false);
      }}
    >
      {options && (
        <>
          <div className="flex items-center gap-3">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${danger ? "bg-pink-strong/15 text-pink-strong" : "bg-accent"}`}>
              <Icon aria-hidden className="size-5" />
            </span>
            <h2 id="confirm-title" className="font-display text-2xl font-semibold">
              {options.title}
            </h2>
          </div>
          <div id="confirm-message" className="mt-3 text-ink-muted">
            {options.message}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus onClick={() => finish(false)} className="min-h-11 rounded-full px-5 font-semibold hover:bg-surface-muted">
              {options.cancelLabel ?? "Annuler"}
            </button>
            <button
              type="button"
              onClick={() => finish(true)}
              className={`min-h-11 rounded-full px-5 font-display text-lg font-semibold ${danger ? "bg-pink-strong text-white" : "bg-button text-button-ink"}`}
            >
              {options.confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
  return [ask, element];
}
