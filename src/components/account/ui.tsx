import type { ReactNode } from "react";
import { Notice } from "@/components/auth/FormParts";
import type { FormState } from "@/app/mon-compte/actions";

export function Card({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  const headingId = id ?? `card-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="rounded-lg bg-white p-5 ring-1 ring-secondary/30 sm:p-6">
      <h2 id={headingId} className="font-display text-2xl font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Notice tone={state.status === "ok" ? "success" : "error"}>{state.message}</Notice>;
}

export const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-secondary/50 bg-white px-5 font-semibold text-ink transition hover:border-ink disabled:opacity-60";

export const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-button px-6 font-display text-lg font-semibold text-button-ink shadow-[0_3px_0_rgba(43,18,32,0.25)] transition hover:brightness-95 disabled:cursor-wait disabled:opacity-70";

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(iso));
}
