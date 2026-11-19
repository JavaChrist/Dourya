import { AlertTriangle, CheckCircle2, Info, LoaderCircle } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

export const inputClass =
  "mt-1.5 h-11 w-full rounded-full border-2 border-secondary/40 bg-white px-4 text-base text-ink focus:border-ink focus:outline-none aria-[invalid=true]:border-pink-strong";

export function Field({
  id,
  label,
  hint,
  error,
  ...input
}: { id: string; label: string; hint?: ReactNode; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-ink">
        {label}
      </label>
      <input id={id} name={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={inputClass} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-bold text-pink-strong">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ pending, children, pendingLabel = "Patientez…" }: { pending: boolean; children: ReactNode; pendingLabel?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-button px-6 font-display text-lg font-semibold text-button-ink shadow-[0_3px_0_rgba(43,18,32,0.25)] transition hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
    >
      {pending && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
      {pending ? pendingLabel : children}
    </button>
  );
}

const tones = {
  error: { icon: AlertTriangle, className: "bg-white ring-2 ring-pink-strong/60", iconClass: "text-pink-strong" },
  success: { icon: CheckCircle2, className: "bg-surface-muted", iconClass: "text-success" },
  info: { icon: Info, className: "bg-accent/40", iconClass: "text-ink" },
} as const;

/** Inline message. Errors use role="alert" so screen readers announce them. */
export function Notice({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-2 rounded-md px-4 py-3 text-sm text-ink ${t.className}`}>
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${t.iconClass}`} />
      <div>{children}</div>
    </div>
  );
}

export function ConfigMissing() {
  return (
    <Notice tone="info">
      La connexion n&apos;est pas encore configurée sur ce site (Firebase). Elle sera disponible prochainement.
    </Notice>
  );
}
