"use client";

import { useActionState, useState } from "react";
import { Images, Plus } from "lucide-react";
import { saveProductAction } from "@/app/admin/catalogue/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage, secondaryButton } from "@/components/account/ui";
import { Field, SubmitButton } from "@/components/auth/FormParts";
import type { Category, Product } from "@/lib/types";
import { FieldError, labelClass, selectClass, textareaClass } from "./shared";

const idle: FormState = { status: "idle" };
const MAX_VARIANTS = 12;
const euros = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2).replace(".", ","));

export function ProductForm({ product, categories }: { product?: Product; categories: Category[] }) {
  const [state, action, pending] = useActionState(saveProductAction, idle);
  const initialRows = Math.max(product?.variants.length ?? 0, 1);
  const [rows, setRows] = useState(Number(state.values?.variantCount ?? initialRows));
  // "Un modèle par photo": rows prefilled from the photos (remounted through `preset`), saved only on submit.
  const [preset, setPreset] = useState<{ version: number; for: FormState; rows: { name: string; image: string }[] } | null>(null);
  // A submit returns a new state: the preset then gives way to the echoed values.
  const active = preset && preset.for === state ? preset : null;
  const images = product?.images ?? [];
  const v = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const e = state.errors ?? {};
  const chosen = new Set((state.values ? (state.values.categorySlugs ?? "").split(",") : product?.categorySlugs) ?? []);
  return (
    <form key={JSON.stringify(state.values ?? null)} action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      {product && <input type="hidden" name="id" value={product.id} />}
      <Field id="name" label="Nom du produit" required maxLength={80} defaultValue={v("name", product?.name)} error={e.name} />
      {product ? (
        <p className="text-sm text-ink-muted">
          Adresse : <code>/produits/{product.slug}</code> (fixe)
        </p>
      ) : (
        <Field id="slug" label="Adresse (facultatif)" hint="Déduite du nom si vide." maxLength={60} defaultValue={v("slug")} error={e.slug} />
      )}
      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea id="description" name="description" maxLength={2000} defaultValue={v("description", product?.description)} aria-invalid={e.description ? true : undefined} className={textareaClass} />
        <FieldError id="description" error={e.description} />
      </div>

      <fieldset>
        <legend className={labelClass}>Rubriques</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-2 rounded-full border-2 border-secondary/40 bg-white px-4 text-ink has-[:checked]:border-ink">
              <input type="checkbox" name="categorySlugs" value={c.slug} defaultChecked={chosen.has(c.slug)} className="size-5 accent-pink-strong" />
              {c.name}
              {!c.visible && <span className="text-xs text-ink-muted">(masquée)</span>}
            </label>
          ))}
        </div>
        <FieldError id="categorySlugs" error={e.categorySlugs} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={labelClass}>Modèles, options et prix</legend>
        <input type="hidden" name="variantCount" value={rows} />
        {Array.from({ length: rows }, (_, i) => {
          const p = active?.rows[i];
          const variant = active ? undefined : product?.variants[i];
          const basePrice = product?.variants[0]?.priceCents ?? null;
          const k = `variant.${i}`;
          const fresh = !!active; // preset rows ignore the echoed values of a previous submit
          const val = (name: string, fallback: string) => (fresh ? fallback : v(`${k}.${name}`, fallback));
          return (
            <div key={`${preset?.version ?? 0}-${i}`} className="grid gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-[2fr_1fr_1.4fr_1fr]">
              {variant && <input type="hidden" name={`${k}.id`} value={variant.id} />}
              <Field id={`${k}.name`} label="Modèle ou option" placeholder="À l'unité" maxLength={40} defaultValue={val("name", p?.name ?? variant?.name ?? (i === 0 && !product ? "À l'unité" : ""))} error={fresh ? undefined : e[`${k}.name`]} />
              <Field id={`${k}.price`} label="Prix (€)" inputMode="decimal" placeholder="6,95" defaultValue={val("price", p ? euros(basePrice) : variant ? euros(variant.priceCents) : "")} error={fresh ? undefined : e[`${k}.price`]} />
              <div>
                <label htmlFor={`${k}.stockMode`} className={labelClass}>
                  Stock
                </label>
                <select id={`${k}.stockMode`} name={`${k}.stockMode`} defaultValue={val("stockMode", variant?.stockMode ?? "stocked")} className={selectClass}>
                  <option value="stocked">Stock limité</option>
                  <option value="made_to_order">Fait à la demande</option>
                </select>
              </div>
              <Field id={`${k}.stock`} label="Quantité" inputMode="numeric" placeholder="à valider" defaultValue={val("stock", variant?.stock == null ? "" : String(variant.stock))} error={fresh ? undefined : e[`${k}.stock`]} />
              {images.length > 0 && (
                <div className="sm:col-span-2">
                  <label htmlFor={`${k}.image`} className={labelClass}>
                    Photo du modèle
                  </label>
                  <select id={`${k}.image`} name={`${k}.image`} defaultValue={val("image", p?.image ?? variant?.imageSrc ?? "")} className={selectClass}>
                    <option value="">Aucune (toutes les photos)</option>
                    {images.map((img, n) => (
                      <option key={img.src} value={img.src}>
                        Photo {n + 1}
                        {n === 0 ? " (couverture)" : ""}
                      </option>
                    ))}
                  </select>
                  <FieldError id={`${k}.image`} error={fresh ? undefined : e[`${k}.image`]} />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2 sm:self-end sm:pb-3">
                <input type="checkbox" name={`${k}.active`} defaultChecked={!fresh && state.values ? state.values[`${k}.active`] === "on" : (variant?.active ?? true)} className="size-5 accent-pink-strong" />
                Modèle ou option en vente
              </label>
            </div>
          );
        })}
        <FieldError id="variants" error={e.variants} />
        <div className="flex flex-wrap gap-2">
          {rows < MAX_VARIANTS && (
            <button type="button" className={secondaryButton} onClick={() => setRows((n) => n + 1)}>
              <Plus aria-hidden className="size-4" />
              Ajouter un modèle ou une option
            </button>
          )}
          {images.length >= 2 && (
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                if (!window.confirm("Remplacer les options par un modèle par photo ? Rien n'est enregistré avant « Enregistrer la fiche ».")) return;
                const list = images.slice(0, MAX_VARIANTS).map((img, n) => ({ name: `Modèle ${n + 1}`, image: img.src }));
                setPreset((prev) => ({ version: (prev?.version ?? 0) + 1, for: state, rows: list }));
                setRows(list.length);
              }}
            >
              <Images aria-hidden className="size-4" />
              Créer un modèle par photo
            </button>
          )}
        </div>
        <p className="text-sm text-ink-muted">
          Plusieurs modèles vendus à la pièce (par exemple des porte-clés) : un modèle par ligne, avec sa photo. Le client choisit son modèle sur la fiche. Prix vide : « prix à fixer ». Quantité vide : « stock à valider ». Une ligne vide est ignorée.
        </p>
      </fieldset>

      <SubmitButton pending={pending} pendingLabel="Enregistrement…">
        {product ? "Enregistrer la fiche" : "Créer la fiche en brouillon"}
      </SubmitButton>
    </form>
  );
}
