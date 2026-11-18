"use server";

import { getListedProducts } from "@/lib/catalog";
import { priceCart } from "@/lib/cart/pricing";
import type { PricedCart } from "@/lib/cart/types";

/**
 * Prices the browser cart on the server. Public on purpose (no account needed),
 * read-only, and the input is treated as untrusted: only ids, variants,
 * quantities and personalisation texts are read; any price sent is ignored.
 */
export async function priceCartAction(items: unknown): Promise<PricedCart> {
  const products = await getListedProducts();
  return priceCart(items, products);
}
