"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Shares the model the customer picked (AddToCart) with the product gallery,
 * so choosing a model shows its photo. `version` changes on every pick, even
 * when the same photo is picked again after browsing other thumbnails.
 */
type ModelSelection = { src: string | null; version: number; select: (src: string | null) => void };

const Context = createContext<ModelSelection | null>(null);

export function ModelSelectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ src: string | null; version: number }>({ src: null, version: 0 });
  const value = useMemo(() => ({ ...state, select: (src: string | null) => setState((s) => ({ src, version: s.version + 1 })) }), [state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Null outside a provider: the gallery and the cart form then work on their own. */
export function useModelSelection(): ModelSelection | null {
  return useContext(Context);
}
