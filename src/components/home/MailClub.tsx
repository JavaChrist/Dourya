import Image from "next/image";
import { Mail } from "lucide-react";
import type { MailClubConfig } from "@/lib/types";
import { Section } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DemoBadge } from "@/components/ui/DemoBadge";

/** Mail Club promo block: image, title, text and call to action, all from data. */
export function MailClub({ config }: { config: MailClubConfig }) {
  if (!config.enabled) return null;
  return (
    <Section background={config.background} labelledBy="mail-club-title" className="py-14 sm:py-20">
      <div className="grid items-center gap-6 rounded-lg bg-white p-5 shadow-xl sm:p-8 md:grid-cols-2 md:gap-10">
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-muted">
          {config.image ? (
            <Image
              src={config.image.src}
              alt={config.image.alt}
              fill
              sizes="(max-width: 768px) 100vw, 560px"
              className="object-cover"
            />
          ) : (
            <div
              role="img"
              aria-label="Visuel de démonstration du Mail Club"
              className="section-bg-grid absolute inset-0 flex items-center justify-center"
            >
              <span className="flex size-24 items-center justify-center rounded-full bg-white shadow-lg">
                <Mail aria-hidden className="size-12 text-pink-strong" strokeWidth={1.75} />
              </span>
            </div>
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {config.eyebrow && (
              <span className="rounded-full bg-accent px-3 py-1 text-sm font-extrabold text-ink uppercase">
                {config.eyebrow}
              </span>
            )}
            {config.isDemo && <DemoBadge />}
          </div>
          <h2 id="mail-club-title" className="mt-3 font-display text-3xl font-semibold text-pink-strong sm:text-4xl">
            {config.title}
          </h2>
          <p className="mt-3 text-lg text-ink">{config.description}</p>
          <ButtonLink href={config.cta.href} className="mt-6">
            {config.cta.label}
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
