"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { formatPrice } from "@/lib/format";
import { PERSONALISATION_PATTERN, normalizePersonalisation } from "@/lib/cart/items";
import { useCart } from "@/components/cart/CartProvider";
import { isUploadedPhotoUrl } from "@/lib/catalog/draft-photo-url";
import { useModelSelection } from "./ModelSelection";

export type VariantOption = {
  id: string;
  name: string;
  priceCents: number | null;
  /** Shown under the option, e.g. "Plus que 3 en stock". */
  note?: string;
  purchasable: boolean;
  /** Highest quantity for one line (stock and per-line cap). */
  maxQuantity: number;
  /** Photo of this model (one of the product images), shown as its thumbnail and in the gallery when picked. */
  imageSrc?: string;
  /** Out of stock: greyed with « Épuisé ». */
  soldOut?: boolean;
};

export type PersonalisationOption = {
  label: string;
  maxLength: number;
  surchargeCents: number;
  instructions?: string;
  /** Empty = every variant. */
  variantIds?: string[];
  /** ISO dates of the availability window, if any. */
  availableFrom?: string;
  availableUntil?: string;
};

function inWindow(p: PersonalisationOption, now: Date): boolean {
  if (p.availableFrom && now < new Date(p.availableFrom)) return false;
  if (p.availableUntil && now > new Date(p.availableUntil)) return false;
  return true;
}

/**
 * Options, quantity and "add to cart". Prices shown here are for information:
 * only ids and quantities go into the cart, the server prices it again.
 */
export function AddToCart({
  productId,
  productName,
  variants,
  personalisation,
}: {
  productId: string;
  productName: string;
  variants: VariantOption[];
  personalisation?: PersonalisationOption;
}) {
  const id = useId();
  const { add } = useCart();
  const selection = useModelSelection();
  // Several models or options: the customer must pick one, nothing is pre-selected.
  const choose = variants.length > 1;
  const models = variants.some((v) => v.imageSrc);
  const noun = models ? "modèle" : "option";
  const [variantId, setVariantId] = useState<string | undefined>(choose ? undefined : variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  // The date window is evaluated after mount, with the visitor's current date.
  const [windowOpen, setWindowOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depends on the current date, client only
    setWindowOpen(!!personalisation && inWindow(personalisation, new Date()));
  }, [personalisation]);

  if (variants.length === 0) return null;
  const variant = choose ? variants.find((v) => v.id === variantId) : variants[0];

  const persoOpen = !!variant && !!personalisation && windowOpen && (!personalisation.variantIds?.length || personalisation.variantIds.includes(variant.id));
  const persoText = persoOpen ? normalizePersonalisation(text) : undefined;
  const unit = !variant || variant.priceCents === null ? null : variant.priceCents + (persoText ? personalisation!.surchargeCents : 0);
  const max = Math.max(1, variant?.maxQuantity ?? 1);

  function submit() {
    setAdded(null);
    if (!variant?.purchasable) return;
    if (persoText) {
      if (persoText.length > personalisation!.maxLength) {
        setError(`${personalisation!.maxLength} caractères maximum.`);
        return;
      }
      if (!PERSONALISATION_PATTERN.test(persoText)) {
        setError("Lettres, chiffres, espaces et ponctuation simple uniquement.");
        return;
      }
    }
    setError(null);
    add({ productId, variantId: variant.id, personalisation: persoText }, Math.min(quantity, max));
    const n = Math.min(quantity, max);
    const label = choose ? `${productName} (${variant.name})` : productName;
    setAdded(`${n} × ${label} ajouté${n > 1 ? "s" : ""} au panier.`);
  }

  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {choose && (
        <fieldset>
          <legend className="font-display text-xl font-semibold text-pink-strong">{models ? "Choisissez votre modèle" : "Choisissez une option"}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {variants.map((v) => (
              <label
                key={v.id}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border-2 px-4 py-2.5 transition has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
                  v.soldOut ? "border-dashed border-secondary/40 bg-surface-muted text-ink-muted" : "border-secondary/40 bg-white"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`${id}-variant`}
                    value={v.id}
                    checked={v.id === variant?.id}
                    onChange={() => {
                      setVariantId(v.id);
                      if (v.imageSrc) selection?.select(v.imageSrc);
                      setQuantity(1);
                      setAdded(null);
                    }}
                    className="size-4 accent-primary"
                  />
                  {v.imageSrc && (
                    <span className={`relative block size-14 shrink-0 overflow-hidden rounded-md ${v.soldOut ? "opacity-50 grayscale" : ""}`}>
                      <Image src={v.imageSrc} alt="" fill sizes="56px" unoptimized={isUploadedPhotoUrl(v.imageSrc)} className="bg-white object-contain" />
                    </span>
                  )}
                  <span>
                    <span className="block font-semibold">{v.name}</span>
                    {v.soldOut ? <span className="block text-xs font-bold">Épuisé</span> : v.note && <span className="block text-xs">{v.note}</span>}
                  </span>
                </span>
                <span className="text-sm font-bold">{formatPrice(v.priceCents)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {persoOpen && personalisation && (
        <div>
          <label htmlFor={`${id}-perso`} className="font-display text-xl font-semibold text-pink-strong">
            {personalisation.label} <span className="font-sans text-sm font-normal text-ink-muted">(facultatif, +{formatPrice(personalisation.surchargeCents)})</span>
          </label>
          <input
            id={`${id}-perso`}
            type="text"
            value={text}
            maxLength={personalisation.maxLength}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
              setAdded(null);
            }}
            aria-describedby={`${id}-perso-help`}
            aria-invalid={!!error}
            className="mt-2 h-11 w-full rounded-full border-2 border-secondary/40 bg-white px-4 text-base text-ink focus:border-ink focus:outline-none"
          />
          <p id={`${id}-perso-help`} className="mt-1 text-sm text-ink-muted">
            {personalisation.instructions ?? `${personalisation.maxLength} caractères maximum.`} {text.length}/{personalisation.maxLength}
          </p>
          {error && (
            <p className="mt-1 text-sm font-bold text-pink-strong" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {variant?.purchasable && (
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span id={`${id}-qty`} className="block text-sm font-bold text-ink">
              Quantité
            </span>
            <div className="mt-1 flex items-center rounded-full border-2 border-secondary/40 bg-white" role="group" aria-labelledby={`${id}-qty`}>
              <button type="button" className="flex size-11 items-center justify-center rounded-full disabled:opacity-40" aria-label="Diminuer la quantité" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus aria-hidden className="size-4" />
              </button>
              <output className="w-8 text-center font-bold" aria-live="polite">
                {quantity}
              </output>
              <button type="button" className="flex size-11 items-center justify-center rounded-full disabled:opacity-40" aria-label="Augmenter la quantité" disabled={quantity >= max} onClick={() => setQuantity((q) => Math.min(max, q + 1))}>
                <Plus aria-hidden className="size-4" />
              </button>
            </div>
          </div>
          <p className="font-display text-3xl font-semibold text-ink">{formatPrice(unit === null ? null : unit * quantity)}</p>
        </div>
      )}

      {/* Not for sale (draft, stock to validate, out of stock): still show its price and why. */}
      {variant && !variant.purchasable && !choose && (variant.priceCents !== null || variant.note) && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {variant.priceCents !== null && <p className="font-display text-3xl font-semibold text-ink">{formatPrice(variant.priceCents)}</p>}
          {variant.note && <p className="text-sm font-bold text-ink-muted">{variant.note}</p>}
        </div>
      )}

      <button
        type="submit"
        disabled={!variant?.purchasable}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-button px-6 font-display text-lg font-semibold text-button-ink shadow-[0_3px_0_rgba(43,18,32,0.25)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/60 disabled:shadow-none"
      >
        <ShoppingBag aria-hidden className="size-5" />
        {!variant ? `Choisissez un${models ? "" : "e"} ${noun}` : variant.purchasable ? "Ajouter au panier" : variant.soldOut ? "Épuisé" : variant.priceCents === null ? "Prix à venir" : "Indisponible"}
      </button>

      <div role="status" aria-live="polite">
        {added && (
          <p className="flex flex-wrap items-center gap-2 rounded-md bg-surface-muted px-4 py-3 font-semibold text-ink">
            <Check aria-hidden className="size-5 text-pink-strong" />
            {added}
            <Link href="/panier" className="ml-auto font-bold text-link hover:underline">
              Voir le panier
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}
