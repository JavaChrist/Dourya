"use client";

import { useActionState } from "react";
import { saveCategoryAction } from "@/app/admin/catalogue/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage } from "@/components/account/ui";
import { Field, SubmitButton } from "@/components/auth/FormParts";
import type { Category } from "@/lib/types";
import { FieldError, ICON_LABEL, labelClass, selectClass } from "./shared";

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
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${p}icon`} className={labelClass}>
            Icône
          </label>
          <select id={`${p}icon`} name="icon" defaultValue={v("icon", category?.icon ?? "sticker")} className={selectClass}>
            {Object.entries(ICON_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError id={`${p}icon`} error={e.icon} />
        </div>
        <Field id={`${p}order`} name="order" label="Ordre d'affichage" inputMode="numeric" defaultValue={v("order", String(category?.order ?? 100))} error={e.order} />
      </div>
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
