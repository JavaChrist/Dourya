/** Marks placeholder content so it is never mistaken for a real DOURYA creation. */
export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold tracking-wide text-white uppercase ${className}`}
    >
      Démo
    </span>
  );
}
