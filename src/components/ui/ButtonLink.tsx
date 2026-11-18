import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "alt";

const styles: Record<Variant, string> = {
  primary: "bg-button text-button-ink hover:brightness-95",
  alt: "bg-button-alt text-button-alt-ink hover:bg-surface-muted",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-2.5 font-display text-lg font-semibold shadow-[0_3px_0_rgba(43,18,32,0.25)] transition hover:-translate-y-0.5 ${styles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
