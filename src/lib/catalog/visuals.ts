import type { Product, Slide } from "@/lib/types";

/**
 * Visuals of a product for galleries and cards: real images first,
 * otherwise clearly labelled demo visuals on DOURYA backgrounds.
 */
export function productVisuals(product: Product): Slide[] {
  if (product.images.length > 0) {
    return product.images.map((image, i) => ({
      id: `${product.id}-img-${i}`,
      title: product.name,
      image,
      isDemo: product.isDemo,
    }));
  }
  const backgrounds = product.demoVisuals?.length ? product.demoVisuals : [{ kind: "grid" as const }];
  return backgrounds.map((background, i) => ({
    id: `${product.id}-demo-${i}`,
    title: product.name,
    background,
    isDemo: true,
  }));
}
