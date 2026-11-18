"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Local cart state (browser only). Lot 1 only shows the counter; adding items,
 * the cart page and orders arrive in later lots. Nothing here is a real order.
 */
export type CartLine = { productSlug: string; variantId: string; quantity: number };

type CartContextValue = {
  lines: CartLine[];
  count: number;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  clear: () => void;
};

const STORAGE_KEY = "dourya-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage once, after mount
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      // Storage unavailable or corrupted: start with an empty cart.
    }
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors (private mode).
    }
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      add: (line, quantity = 1) => {
        const existing = lines.find((l) => l.productSlug === line.productSlug && l.variantId === line.variantId);
        persist(
          existing
            ? lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity } : l))
            : [...lines, { ...line, quantity }],
        );
      },
      clear: () => persist([]),
    }),
    [lines, persist],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
