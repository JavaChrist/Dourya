import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { minPrice, productPageState } from "@/lib/catalog/visibility";
import { productVisuals } from "@/lib/catalog/visuals";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { DraftBadge } from "@/components/ui/DraftBadge";
import { SlideVisual } from "@/components/ui/SlideVisual";

/** Product tile used by the shop, category and collection listings. */
export function ProductCard({ product }: { product: Product }) {
  const visual = productVisuals(product)[0];
  const price = minPrice(product);
  const prices = new Set(product.variants.filter((v) => v.active && v.priceCents !== null).map((v) => v.priceCents));
  const unavailable = productPageState(product) !== "available";

  return (
    <Link href={`/produits/${product.slug}`} className="group block rounded-md">
      <div className="relative aspect-[4/5] overflow-hidden rounded-md shadow-[0_4px_0_rgba(43,18,32,0.12)] transition group-hover:-translate-y-0.5">
        <SlideVisual slide={visual} sizes="(max-width: 768px) 50vw, 25vw" />
        {unavailable && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-bold text-ink">
            {price === null ? "Prix à venir" : "Indisponible"}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-display text-lg leading-tight font-semibold text-ink group-hover:text-pink-strong">
          {product.name}
        </span>
        {product.isDemo && <DemoBadge />}
        {product.status === "draft" && <DraftBadge />}
      </div>
      <span className="text-sm text-ink-muted">
        {price !== null && prices.size > 1 ? `Dès ${formatPrice(price)}` : formatPrice(price)}
      </span>
    </Link>
  );
}
