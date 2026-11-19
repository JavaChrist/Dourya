"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
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

      <div>
        <label htmlFor="status" className={labelClass}>
          Statut
        </label>
        <select id="status" name="status" defaultValue={v("status", product?.status === "archived" ? "archived" : "draft")} className={selectClass}>
          <option value="draft">Brouillon (visible dans l&apos;administration seulement)</option>
          <option value="archived">Archivé</option>
        </select>
        <p className="mt-1 text-sm text-ink-muted">La publication n&apos;est pas ouverte pendant le développement.</p>
        <FieldError id="status" error={e.status} />
      </div>

      <fieldset className="space-y-3">
        <legend className={labelClass}>Options et prix</legend>
        <input type="hidden" name="variantCount" value={rows} />
        {Array.from({ length: rows }, (_, i) => {
          const variant = product?.variants[i];
          const k = `variant.${i}`;
          return (
            <div key={i} className="grid gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-[2fr_1fr_1.4fr_1fr]">
              {variant && <input type="hidden" name={`${k}.id`} value={variant.id} />}
              <Field id={`${k}.name`} label="Option" placeholder="À l'unité" maxLength={40} defaultValue={v(`${k}.name`, variant?.name ?? (i === 0 && !product ? "À l'unité" : ""))} error={e[`${k}.name`]} />
              <Field id={`${k}.price`} label="Prix (€)" inputMode="decimal" placeholder="6,95" defaultValue={v(`${k}.price`, variant ? euros(variant.priceCents) : "")} error={e[`${k}.price`]} />
              <div>
                <label htmlFor={`${k}.stockMode`} className={labelClass}>
                  Stock
                </label>
                <select id={`${k}.stockMode`} name={`${k}.stockMode`} defaultValue={v(`${k}.stockMode`, variant?.stockMode ?? "stocked")} className={selectClass}>
                  <option value="stocked">Stock limité</option>
                  <option value="made_to_order">Fait à la demande</option>
                </select>
              </div>
              <Field id={`${k}.stock`} label="Quantité" inputMode="numeric" placeholder="à valider" defaultValue={v(`${k}.stock`, variant?.stock == null ? "" : String(variant.stock))} error={e[`${k}.stock`]} />
              <label className="flex items-center gap-2 text-sm text-ink sm:col-span-4">
                <input type="checkbox" name={`${k}.active`} defaultChecked={state.values ? state.values[`${k}.active`] === "on" : (variant?.active ?? true)} className="size-5 accent-pink-strong" />
                Option active
              </label>
            </div>
          );
        })}
        <FieldError id="variants" error={e.variants} />
        {rows < MAX_VARIANTS && (
          <button type="button" className={secondaryButton} onClick={() => setRows((n) => n + 1)}>
            <Plus aria-hidden className="size-4" />
            Ajouter une option
          </button>
        )}
        <p className="text-sm text-ink-muted">Prix vide : « prix à fixer ». Quantité vide : « stock à valider ». Une option vide est ignorée.</p>
      </fieldset>

      <SubmitButton pending={pending} pendingLabel="Enregistrement…">
        {product ? "Enregistrer la fiche" : "Créer la fiche en brouillon"}
      </SubmitButton>
    </form>
  );
}
