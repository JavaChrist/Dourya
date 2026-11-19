/** Marks an unpublished product, visible only on the draft preview. */
export function DraftBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border-2 border-dashed border-ink px-2.5 py-0.5 text-xs font-bold tracking-wide text-ink uppercase ${className}`}
    >
      Brouillon
    </span>
  );
}
