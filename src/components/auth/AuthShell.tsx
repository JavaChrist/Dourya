import type { ReactNode } from "react";

/** Centered card used by every sign-in / sign-up page. */
export function AuthShell({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <h1 className="font-display text-4xl font-semibold text-pink-strong">{title}</h1>
      {intro && <div className="mt-3 text-ink-muted">{intro}</div>}
      <div className="mt-6 rounded-lg bg-white p-5 ring-1 ring-secondary/30 sm:p-6">{children}</div>
      {footer && <div className="mt-5 space-y-2 text-sm text-ink">{footer}</div>}
    </div>
  );
}
