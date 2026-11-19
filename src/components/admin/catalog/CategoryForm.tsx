"use client";

import { useActionState } from "react";
import { saveCategoryAction } from "@/app/admin/catalogue/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage } from "@/components/account/ui";
import { Field, SubmitButton } from "@/components/auth/FormParts";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import type { Category, CategoryIconName } from "@/lib/types";
import { FieldError, ICON_LABEL, labelClass } from "./shared";

const idle: FormState = { status: "idle" };

export function CategoryForm({ category }: { category?: Category }) {
  const [state, action, pending] = useActionState(saveCategoryAction, idle);
  const v = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const e = state.errors ?? {};
  const p = category ? `cat-${category.id}-` : "cat-new-";
  return (
    <form key={JSON.stringify(state.values ?? null)} action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      {category && <input type="hidden" name="id" value={category.id} />}
      <Field id={`${p}name`} name="name" label="Nom" required maxLength={40} defaultValue={v("name", category?.name)} error={e.name} />
      {category ? (
        <p className="text-sm text-ink-muted">
          Adresse : <code>/categories/{category.slug}</code> (fixe)
        </p>
      ) : (
        <Field id={`${p}slug`} name="slug" label="Adresse (facultatif)" hint="Déduite du nom si vide : lettres minuscules, chiffres, tirets." maxLength={60} defaultValue={v("slug")} error={e.slug} />
      )}
      <Field id={`${p}description`} name="description" label="Description courte" maxLength={160} defaultValue={v("description", category?.description)} error={e.description} />
      <fieldset>
        <legend className={labelClass}>Icône</legend>
        <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
          {(Object.entries(ICON_LABEL) as [CategoryIconName, string][]).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-secondary/40 bg-white p-2 text-center text-xs font-semibold text-ink transition hover:border-ink has-[:checked]:border-pink-strong has-[:checked]:bg-secondary/20 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
            >
              <input type="radio" name="icon" value={value} defaultChecked={v("icon", category?.icon ?? "sticker") === value} className="sr-only" />
              <CategoryIcon name={value} className="size-6 text-pink-strong" />
              {label}
            </label>
          ))}
        </div>
        <FieldError id={`${p}icon`} error={e.icon} />
      </fieldset>
      <Field
        id={`${p}order`}
        name="order"
        label="Ordre d'affichage"
        hint="Place de la rubrique dans les filtres, les menus et l'accueil : le plus petit nombre passe en premier (les rubriques du site vont de 1 à 4). À égalité, ordre alphabétique."
        inputMode="numeric"
        defaultValue={v("order", String(category?.order ?? 100))}
        error={e.order}
      />
      <label className="flex items-center gap-2 text-ink">
        <input type="checkbox" name="visible" defaultChecked={state.values ? state.values.visible === "on" : (category?.visible ?? true)} className="size-5 accent-pink-strong" />
        Visible dans la boutique (filtres, page de la rubrique, accueil et sitemap, dès l&apos;enregistrement)
      </label>
      <SubmitButton pending={pending} pendingLabel="Enregistrement…">
        {category ? "Enregistrer la rubrique" : "Créer la rubrique"}
      </SubmitButton>
    </form>
  );
}
