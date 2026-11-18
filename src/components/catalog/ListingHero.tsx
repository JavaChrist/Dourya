import type { ReactNode } from "react";
import { Section } from "@/components/ui/Section";

/** Pink DOURYA header shared by the shop, category and collection pages. */
export function ListingHero({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <Section background={{ kind: "grid" }} className="py-10 sm:py-12">
      <div className="flex items-center gap-4">
        {icon && <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white sm:size-16">{icon}</span>}
        <h1 className="font-display text-4xl font-semibold text-white drop-shadow-[0_2px_0_rgba(43,18,32,0.35)] sm:text-5xl">
          {title}
        </h1>
      </div>
      {description && <p className="mt-3 max-w-2xl rounded-md bg-white/90 px-4 py-2 text-ink">{description}</p>}
    </Section>
  );
}

/** Placeholder while the URL-dependent part of a listing loads. */
export function ListingFallback() {
  return <div aria-busy="true" className="mx-auto min-h-[50vh] max-w-6xl px-4 py-10 sm:px-6" />;
}
