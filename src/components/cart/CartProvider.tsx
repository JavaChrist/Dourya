"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CART_LIMITS, lineKey, sanitizeCartItems } from "@/lib/cart/items";
import type { CartItem } from "@/lib/cart/types";

/**
 * Guest cart kept in the browser (localStorage). It only holds ids,
 * variants, quantities and personalisation texts: prices are always
 * computed by the server (see app/panier/actions.ts). Lot 3 will merge it
 * into the account cart at sign-in (lib/cart/items.ts mergeCarts).
 */
type CartContextValue = {
  items: CartItem[];
  /** Units in the local cart (shown on the header icon). */
  count: number;
  /** False until the cart has been read from storage. */
  ready: boolean;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** Replaces the whole cart (e.g. with the quantities accepted by the server). */
  replaceAll: (items: CartItem[]) => void;
};

const STORAGE_KEY = "dourya-cart-v2";
const CartContext = createContext<CartContextValue | null>(null);

function read(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeCartItems(JSON.parse(raw)) : [];
  } catch {
    return []; // Storage unavailable or corrupted: start with an empty cart.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate from storage once, after mount */
    setItems(read());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Keep several open tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setItems(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback((update: (prev: CartItem[]) => CartItem[]) => {
    setItems((prev) => {
      const next = sanitizeCartItems(update(prev));
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors (private mode): the cart still works for this tab.
      }
      return next;
    });
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      ready,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      // Same line (product + variant + personalisation) is combined by sanitizeCartItems.
      add: (item, quantity = 1) => commit((prev) => [...prev, { ...item, quantity }]),
      setQuantity: (key, quantity) =>
        commit((prev) =>
          prev
            .map((i) => (lineKey(i) === key ? { ...i, quantity: Math.min(Math.floor(quantity), CART_LIMITS.maxQuantity) } : i))
            .filter((i) => i.quantity > 0),
        ),
      remove: (key) => commit((prev) => prev.filter((i) => lineKey(i) !== key)),
      clear: () => commit(() => []),
      replaceAll: (next) => commit(() => next),
    }),
    [items, ready, commit],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
