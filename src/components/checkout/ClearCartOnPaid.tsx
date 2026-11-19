"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/CartProvider";

/** Rendered only once the server saw the order paid at Stripe: empties the local cart. */
export function ClearCartOnPaid() {
  const { ready, clear, items } = useCart();
  useEffect(() => {
    if (ready && items.length > 0) clear();
    try {
      sessionStorage.removeItem("dourya.checkout.attempt");
    } catch {
      // ignored
    }
  }, [ready, clear, items.length]);
  return null;
}
