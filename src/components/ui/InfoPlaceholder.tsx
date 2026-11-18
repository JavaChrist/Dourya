import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink } from "./ButtonLink";

/** Generic page body for content that will arrive in a later lot. */
export function InfoPlaceholder({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-pink-strong">{title}</h1>
      <div className="mt-6 flex gap-3 rounded-md border-2 border-dashed border-secondary bg-surface-muted p-5">
        <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-pink-strong" />
        <div className="space-y-2 text-ink">
          {children ?? <p>Contenu à venir. Cette page sera complétée dans un prochain lot.</p>}
        </div>
      </div>
      <div className="mt-8">
        <ButtonLink href="/" variant="alt" className="border-2 border-secondary">
          Retour à l&apos;accueil
        </ButtonLink>
      </div>
    </div>
  );
}
