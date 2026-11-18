import { commerceConfig } from "@/config/commerce";
import type { CartItem } from "./types";

/** Hard limits applied to any cart received from a browser. */
export const CART_LIMITS = {
  maxLines: commerceConfig.maxCartLines,
  maxQuantity: 99,
  maxIdLength: 100,
  maxPersonalisationLength: 200,
} as const;

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Personalisation: letters (accents included), digits, spaces and simple punctuation. */
export const PERSONALISATION_PATTERN = /^[\p{L}\p{N} .,'’&!?-]+$/u;

/** Normalises a personalisation text (trim, single spaces). */
export function normalizePersonalisation(text: string | undefined): string | undefined {
  const t = text?.replace(/\s+/g, " ").trim();
  return t ? t : undefined;
}

/** A line is identified by product + variant + options. */
export function lineKey(item: Pick<CartItem, "productId" | "variantId" | "personalisation">): string {
  return [item.productId, item.variantId, normalizePersonalisation(item.personalisation) ?? ""].join("|");
}

function isId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= CART_LIMITS.maxIdLength && ID_PATTERN.test(v);
}

/**
 * Turns untrusted input (localStorage, network) into clean cart items:
 * unknown fields (prices included) are dropped, bad entries skipped,
 * duplicates combined. `combine` decides how duplicate lines are joined.
 */
export function sanitizeCartItems(input: unknown, combine: "sum" | "max" = "sum"): CartItem[] {
  if (!Array.isArray(input)) return [];
  const byKey = new Map<string, CartItem>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (!isId(r.productId) || !isId(r.variantId)) continue;
    if (typeof r.quantity !== "number" || !Number.isFinite(r.quantity)) continue;
    const quantity = Math.min(Math.floor(r.quantity), CART_LIMITS.maxQuantity);
    if (quantity < 1) continue;
    const personalisation =
      typeof r.personalisation === "string"
        ? normalizePersonalisation(r.personalisation.slice(0, CART_LIMITS.maxPersonalisationLength))
        : undefined;

    const item: CartItem = { productId: r.productId, variantId: r.variantId, quantity };
    if (personalisation) item.personalisation = personalisation;
    const key = lineKey(item);
    const existing = byKey.get(key);
    if (existing) {
      const joined = combine === "sum" ? existing.quantity + quantity : Math.max(existing.quantity, quantity);
      existing.quantity = Math.min(joined, CART_LIMITS.maxQuantity);
    } else if (byKey.size < CART_LIMITS.maxLines) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}

/**
 * Merges the guest cart into the account cart at sign-in (wired in Lot 3).
 * Same line in both carts: the highest quantity is kept, so merging twice,
 * or merging a cart already synced, never doubles quantities. Nothing is lost:
 * every line of both carts is kept. Stock and caps are applied by the server.
 */
export function mergeCarts(accountItems: unknown, guestItems: unknown): CartItem[] {
  const account = sanitizeCartItems(accountItems);
  const guest = sanitizeCartItems(guestItems);
  return sanitizeCartItems([...account, ...guest], "max");
}
