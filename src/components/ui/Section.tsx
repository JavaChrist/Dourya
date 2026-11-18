import type { CSSProperties, ReactNode } from "react";
import type { SectionBackground } from "@/lib/types";

/** Returns the class and inline style for a configurable section background. */
export function backgroundProps(bg: SectionBackground | undefined): {
  className: string;
  style?: CSSProperties;
} {
  switch (bg?.kind) {
    case "grid":
      return { className: "section-bg-grid" };
    case "sparkle":
      return { className: "section-bg-sparkle" };
    case "solid":
      return { className: "", style: { backgroundColor: bg.color } };
    default:
      return { className: "" };
  }
}

type SectionProps = {
  background?: SectionBackground;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
  id?: string;
};

export function Section({ background, className = "", children, labelledBy, id }: SectionProps) {
  const bg = backgroundProps(background);
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`${bg.className} ${className}`}
      style={bg.style}
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}
