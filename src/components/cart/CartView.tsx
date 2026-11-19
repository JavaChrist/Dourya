"use client";

import Link from "next/link";
import { AlertTriangle, Info, Lock, Minus, Plus, RefreshCw, ShoppingBag, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { priceCartAction } from "@/app/panier/actions";
import { formatPrice } from "@/lib/format";
import { lineKey } from "@/lib/cart/items";
import type { CartItem, PricedCart, PricedLine } from "@/lib/cart/types";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { SlideVisual } from "@/components/ui/SlideVisual";
import { useCart } from "./CartProvider";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; cart: PricedCart };

/**
 * Cart page. Every display (prices, totals, max quantities) comes from the
 * server pricing of the local cart; the browser never computes a price.
 */
export function CartView() {
  const { items, ready, setQuantity, remove, replaceAll } = useCart();
  const [state, setState] = useState<State>({ kind: "loading" });
  const requestId = useRef(0);

  const price = useCallback(async (toPrice: CartItem[]) => {
    const id = ++requestId.current;
    try {
      const cart = await priceCartAction(toPrice);
      if (id === requestId.current) setState({ kind: "ready", cart });
    } catch {
      if (id === requestId.current) setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the server answers, never synchronously
    void price(items);
  }, [ready, items, price]);

  // Apply the quantities lowered by the server (stock, per-line cap) to the local cart.
  useEffect(() => {
    if (state.kind !== "ready") return;
    const adjusted = new Map(state.cart.lines.filter((l) => l.status === "adjusted").map((l) => [l.key, l.quantity]));
    if (adjusted.size === 0) return;
    replaceAll(items.map((i) => {
      const quantity = adjusted.get(lineKey(i));
      return quantity ? { ...i, quantity } : i;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to a new server answer
  }, [state]);

  if (!ready || (state.kind === "loading" && items.length > 0)) {
    return <p className="mt-8 text-ink-muted" role="status">Calcul du panier…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center rounded-lg border-2 border-dashed border-secondary/50 px-6 py-14 text-center">
        <ShoppingBag aria-hidden className="size-10 text-pink-strong" />
        <p className="mt-3 font-display text-2xl font-semibold text-ink">Votre panier est vide</p>
        <Link href="/boutique" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-button px-6 font-display text-lg font-semibold text-button-ink shadow-[0_3px_0_rgba(43,18,32,0.25)] hover:brightness-95">
          Découvrir la boutique
        </Link>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mt-8 rounded-lg bg-surface-muted px-6 py-8 text-center" role="alert">
        <p className="font-semibold text-ink">Le panier n&apos;a pas pu être calculé. Vérifiez votre connexion.</p>
        <button type="button" onClick={() => void price(items)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-button px-6 font-semibold text-button-ink">
          <RefreshCw aria-hidden className="size-4" />
          Réessayer
        </button>
      </div>
    );
  }

  if (state.kind !== "ready") return null;
  const { cart } = state;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <ul className="divide-y divide-secondary/30 rounded-lg bg-white ring-1 ring-secondary/30">
        {cart.lines.map((line) => (
          <CartLine key={line.key} line={line} onQuantity={(q) => setQuantity(line.key, q)} onRemove={() => remove(line.key)} />
        ))}
      </ul>

      <aside aria-labelledby="cart-summary" className="rounded-lg bg-surface-muted p-5 lg:sticky lg:top-28">
        <h2 id="cart-summary" className="font-display text-2xl font-semibold text-ink">
          Récapitulatif
        </h2>
        <dl className="mt-4 space-y-2">
          <div className="flex justify-between gap-4">
            <dt>Sous-total ({cart.itemCount} article{cart.itemCount > 1 ? "s" : ""})</dt>
            <dd className="font-bold">{formatPrice(cart.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-sm text-ink-muted">
            <dt>Livraison</dt>
            <dd>Calculée avant le paiement</dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-secondary/40 pt-3 text-sm text-ink-muted">
          Le total à payer, livraison comprise, sera indiqué avant le paiement.
        </p>

        {cart.hasDemo && (
          <p className="mt-4 flex gap-2 rounded-md bg-accent/50 px-3 py-2 text-sm text-ink">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            Votre panier contient des produits de démonstration aux prix fictifs : aucune commande n&apos;est possible.
          </p>
        )}
        {cart.hasBlockingIssue && (
          <p className="mt-3 flex gap-2 rounded-md bg-white px-3 py-2 text-sm text-ink">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-pink-strong" />
            Retirez les articles indisponibles pour continuer.
          </p>
        )}

        {cart.checkoutAllowed ? (
          <Link
            href="/commande"
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-button px-6 font-display text-lg font-semibold text-button-ink shadow-[0_3px_0_rgba(43,18,32,0.25)] hover:brightness-95"
          >
            <Lock aria-hidden className="size-5" />
            Passer au paiement
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-button px-6 font-display text-lg font-semibold text-button-ink shadow-[0_3px_0_rgba(43,18,32,0.25)] disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/60 disabled:shadow-none"
          >
            <Lock aria-hidden className="size-5" />
            Passer au paiement
          </button>
        )}
        {!cart.checkoutAllowed && <p className="mt-2 text-center text-xs text-ink-muted">Le paiement en ligne ouvrira prochainement.</p>}
      </aside>
    </div>
  );
}

function CartLine({ line, onQuantity, onRemove }: { line: PricedLine; onQuantity: (q: number) => void; onRemove: () => void }) {
  const orderable = line.status === "ok" || line.status === "adjusted";
  const name = line.productName ?? "Produit retiré";

  return (
    <li className="flex gap-4 p-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-md sm:size-24">
        <SlideVisual
          slide={{ id: line.key, title: name, image: line.image, background: line.demoVisual ?? { kind: "grid" }, isDemo: line.isDemo }}
          sizes="96px"
          className="[&>div]:hidden"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {line.productSlug ? (
            <Link href={`/produits/${line.productSlug}`} className="font-display text-lg leading-tight font-semibold text-ink hover:text-pink-strong">
              {name}
            </Link>
          ) : (
            <span className="font-display text-lg font-semibold text-ink">{name}</span>
          )}
          {line.isDemo && <DemoBadge />}
        </div>
        {line.variantName && <p className="text-sm text-ink-muted">{line.variantName}</p>}
        {line.personalisation && (
          <p className="text-sm text-ink-muted">
            {line.personalisation.label} : « {line.personalisation.text} » (+{formatPrice(line.personalisation.surchargeCents)})
          </p>
        )}
        {line.message && (
          <p className={`mt-1 text-sm font-semibold ${orderable ? "text-ink" : "text-pink-strong"}`} role={orderable ? undefined : "alert"}>
            {line.message}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {orderable && (
            <div className="flex items-center rounded-full border-2 border-secondary/40" role="group" aria-label={`Quantité de ${name}`}>
              <button type="button" className="flex size-11 items-center justify-center disabled:opacity-40" aria-label="Diminuer la quantité" disabled={line.quantity <= 1} onClick={() => onQuantity(line.quantity - 1)}>
                <Minus aria-hidden className="size-4" />
              </button>
              <output className="w-8 text-center font-bold">{line.quantity}</output>
              <button type="button" className="flex size-11 items-center justify-center disabled:opacity-40" aria-label="Augmenter la quantité" disabled={line.quantity >= line.maxQuantity} onClick={() => onQuantity(line.quantity + 1)}>
                <Plus aria-hidden className="size-4" />
              </button>
            </div>
          )}
          <button type="button" onClick={onRemove} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-link hover:bg-surface-muted">
            <Trash2 aria-hidden className="size-4" />
            Retirer
          </button>
          {orderable && line.unitPriceCents !== null && (
            <p className="ml-auto text-right">
              <span className="block font-bold text-ink">{formatPrice(line.lineTotalCents)}</span>
              {line.quantity > 1 && <span className="block text-xs text-ink-muted">{formatPrice(line.unitPriceCents)} l&apos;unité</span>}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
