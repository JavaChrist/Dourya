import Image from "next/image";
import Link from "next/link";
import type { Category, SectionBackground } from "@/lib/types";
import { Section } from "@/components/ui/Section";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

/** Category tiles. The list (visible, order) comes from src/data/categories.ts. */
export function CategoryGrid({
  categories,
  background,
}: {
  categories: Category[];
  background: SectionBackground;
}) {
  if (categories.length === 0) return null;
  return (
    <Section background={background} labelledBy="categories-title" className="py-14 sm:py-20">
      <h2
        id="categories-title"
        className="text-center font-display text-4xl font-semibold text-white drop-shadow-[0_2px_0_rgba(43,18,32,0.35)] sm:text-5xl"
      >
        Catégories
      </h2>
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
        {categories.map((cat, i) => (
          <li key={cat.slug} className={categories.length % 2 === 1 && i === categories.length - 1 ? "col-span-2 md:col-span-1" : ""}>
            <Link
              href={`/categories/${cat.slug}`}
              className="group flex h-full flex-col items-center rounded-lg bg-white p-5 text-center shadow-[0_6px_0_rgba(43,18,32,0.18)] transition hover:-translate-y-1 sm:p-8"
            >
              <span className="relative flex size-20 items-center justify-center overflow-hidden rounded-full bg-surface-muted ring-4 ring-accent transition group-hover:rotate-6 sm:size-28">
                {cat.image ? (
                  <Image src={cat.image.src} alt="" fill sizes="112px" className="object-cover" />
                ) : (
                  <CategoryIcon name={cat.icon} className="size-10 text-pink-strong sm:size-14" />
                )}
              </span>
              <span className="mt-4 font-display text-2xl font-semibold text-ink sm:text-3xl">{cat.name}</span>
              {cat.description && <span className="mt-1 text-sm text-ink-muted sm:text-base">{cat.description}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
