"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ImageIcon, Plus, RotateCcw, Trash2 } from "lucide-react";
import { resetHomeAction, saveHomeAction } from "@/app/admin/accueil/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { Card, FormMessage, primaryButton, secondaryButton } from "@/components/account/ui";
import { inputClass } from "@/components/auth/FormParts";
import { labelClass, selectClass } from "@/components/admin/catalog/shared";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { HOME_LIMITS, type CarouselKey, type HomeCarousels, type HomeSlideInput, type ImageChoice } from "@/lib/home/carousels";
import type { HomeOptions, LinkChoice } from "@/lib/home/admin-options";
import { ImagePicker, Thumb } from "./ImagePicker";

const idle: FormState = { status: "idle" };
const newId = () => `s${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

const COPY: Record<CarouselKey, { title: string; intro: string; link: string; prefix: string; empty: string }> = {
  hero: {
    title: "À la une",
    intro: "Le grand carrousel du haut de l'accueil, qui défile tout seul. Chaque diapo mène à une rubrique.",
    link: "Rubrique",
    prefix: "/categories/",
    empty: "Aucune diapo : le carrousel « À la une » n'apparaît pas.",
  },
  selection: {
    title: "Sélection",
    intro: "Le carrousel « Notre sélection », que le visiteur fait défiler. Chaque diapo mène à un produit.",
    link: "Produit",
    prefix: "/produits/",
    empty: "Aucune diapo : le carrousel « Sélection » n'apparaît pas.",
  },
};

const toInput = (c: HomeCarousels): Record<CarouselKey, HomeSlideInput[]> => {
  const one = (s: HomeCarousels["hero"][number]): HomeSlideInput => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle ?? "",
    imageSrc: s.image.src,
    alt: s.image.alt,
    href: s.href,
    linkLabel: s.linkLabel ?? "",
    active: s.active,
  });
  return { hero: c.hero.map(one), selection: c.selection.map(one) };
};

/**
 * Admin → Accueil editor. The whole state is sent as one JSON field
 * (`payload`) and validated again on the server. Fields are controlled so a
 * refused save keeps what was typed.
 */
export function HomeCarouselsForm({ initial, options, stored }: { initial: HomeCarousels; options: HomeOptions; stored: boolean }) {
  const [state, action, pending] = useActionState(saveHomeAction, idle);
  const [resetState, resetAction, resetting] = useActionState(resetHomeAction, idle);
  const [ask, dialog] = useConfirm();
  const form = useRef<HTMLFormElement>(null);
  const resetForm = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const resetConfirmed = useRef(false);
  const [slides, setSlides] = useState(() => toInput(initial));
  const [picking, setPicking] = useState<{ key: CarouselKey; id: string } | null>(null);
  const [seenReset, setSeenReset] = useState(resetState);
  if (resetState !== seenReset) {
    // After « Revenir au contenu d'origine », show the carousels of the code (the page re-rendered with them).
    setSeenReset(resetState);
    if (resetState.status === "ok") setSlides(toInput(initial));
  }
  const errors = state.status === "error" ? (state.errors ?? {}) : {};

  const images = useMemo(() => new Map(options.images.map((i) => [i.src, i])), [options.images]);
  const links: Record<CarouselKey, LinkChoice[]> = { hero: options.categories, selection: options.products };

  const update = (key: CarouselKey, id: string, patch: Partial<HomeSlideInput>) =>
    setSlides((all) => ({ ...all, [key]: all[key].map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const move = (key: CarouselKey, index: number, by: -1 | 1) =>
    setSlides((all) => {
      const list = [...all[key]];
      const to = index + by;
      if (to < 0 || to >= list.length) return all;
      [list[index], list[to]] = [list[to], list[index]];
      return { ...all, [key]: list };
    });
  const add = (key: CarouselKey) =>
    setSlides((all) => ({ ...all, [key]: [...all[key], { id: newId(), title: "", subtitle: "", imageSrc: "", alt: "", href: "", linkLabel: "", active: true }] }));
  const remove = async (key: CarouselKey, slide: HomeSlideInput) => {
    const ok = await ask({
      title: "Supprimer cette diapo ?",
      message: `« ${slide.title || "Diapo sans titre"} » sera retirée du carrousel ${COPY[key].title}. Rien n'est enregistré tant que vous ne cliquez pas sur « Enregistrer l'accueil ».`,
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (ok) setSlides((all) => ({ ...all, [key]: all[key].filter((s) => s.id !== slide.id) }));
  };
  const pick = (choice: ImageChoice) => {
    if (!picking) return;
    const current = slides[picking.key].find((s) => s.id === picking.id);
    update(picking.key, picking.id, { imageSrc: choice.src, ...(current && !current.alt.trim() && choice.alt ? { alt: choice.alt } : {}) });
    setPicking(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    event.preventDefault();
    const count = (key: CarouselKey) => slides[key].filter((s) => s.active).length;
    const ok = await ask({
      title: "Enregistrer l'accueil ?",
      message: `À la une : ${count("hero")} diapo(s) active(s). Sélection : ${count("selection")} diapo(s) active(s). La page d'accueil est mise à jour tout de suite.`,
      confirmLabel: "Enregistrer",
    });
    if (ok) {
      confirmed.current = true;
      form.current?.requestSubmit();
    }
  };

  const onReset = async (event: FormEvent<HTMLFormElement>) => {
    if (resetConfirmed.current) {
      resetConfirmed.current = false;
      return;
    }
    event.preventDefault();
    const ok = await ask({
      title: "Revenir au contenu d'origine ?",
      message: "Vos diapos enregistrées sont effacées et l'accueil reprend les carrousels prévus à la création du site. Cette action ne peut pas être annulée.",
      confirmLabel: "Revenir à l'origine",
      tone: "danger",
    });
    if (ok) {
      resetConfirmed.current = true;
      resetForm.current?.requestSubmit();
    }
  };

  const fieldError = (name: string) =>
    errors[name] ? (
      <span id={`${name}-error`} className="mt-1 block text-xs font-normal text-pink-strong">
        {errors[name]}
      </span>
    ) : null;
  const invalid = (name: string) => (errors[name] ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {});

  const text = (key: CarouselKey, s: HomeSlideInput, name: "title" | "subtitle" | "linkLabel" | "alt", label: string, max: number, hint?: string) => {
    const n = `${s.id}.${name}`;
    return (
      <label className={labelClass}>
        {label}
        {hint && <span className="font-normal text-ink-muted"> ({hint})</span>}
        <input
          id={n}
          value={s[name]}
          onChange={(e) => update(key, s.id, { [name]: e.target.value })}
          maxLength={max}
          autoComplete="off"
          {...invalid(n)}
          className={`${inputClass} px-3 text-sm`}
        />
        {fieldError(n)}
      </label>
    );
  };

  const carousel = (key: CarouselKey) => {
    const list = slides[key];
    const copy = COPY[key];
    return (
      <Card title={copy.title}>
        <p className="text-ink-muted">{copy.intro} L&apos;ordre ci-dessous est l&apos;ordre d&apos;affichage. Une diapo inactive est gardée ici mais n&apos;apparaît pas.</p>
        {errors[key] && <p className="mt-2 text-sm text-pink-strong">{errors[key]}</p>}
        {list.length === 0 && <p className="mt-4 rounded-2xl bg-surface-muted p-4 text-ink">{copy.empty}</p>}
        <ol className="mt-4 space-y-4">
          {list.map((s, i) => {
            const image = images.get(s.imageSrc);
            const link = links[key].find((l) => `${copy.prefix}${l.slug}` === s.href);
            const hrefName = `${s.id}.href`;
            return (
              <li key={s.id}>
                <fieldset className={`rounded-2xl border-2 p-4 ${s.active ? "border-secondary/30" : "border-dashed border-secondary/40 bg-surface-muted/50"}`}>
                  <legend className="px-2 font-semibold text-ink">
                    Diapo {i + 1}
                    {s.title ? ` : ${s.title}` : ""}
                    {!s.active && <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold text-ink-muted">inactive</span>}
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                    <div>
                      <button
                        type="button"
                        onClick={() => setPicking({ key, id: s.id })}
                        aria-label={image ? "Changer la photo" : "Choisir une photo"}
                        aria-describedby={errors[`${s.id}.image`] ? `${s.id}.image-error` : undefined}
                        className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-surface-muted ring-2 transition hover:ring-ink ${errors[`${s.id}.image`] ? "ring-pink-strong" : "ring-secondary/30"}`}
                      >
                        {image ? (
                          <Thumb choice={image} sizes="160px" />
                        ) : (
                          <span className="flex flex-col items-center gap-1 text-sm font-semibold text-ink-muted">
                            <ImageIcon aria-hidden className="size-6" />
                            {s.imageSrc ? "Photo introuvable" : "Choisir une photo"}
                          </span>
                        )}
                      </button>
                      {image && (
                        <button type="button" onClick={() => setPicking({ key, id: s.id })} className="mt-2 text-sm font-semibold text-ink underline underline-offset-4">
                          Changer la photo
                        </button>
                      )}
                      {fieldError(`${s.id}.image`)}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {text(key, s, "title", "Titre", HOME_LIMITS.title)}
                      {text(key, s, "subtitle", "Sous-titre", HOME_LIMITS.subtitle, "facultatif")}
                      <label className={labelClass}>
                        {copy.link}
                        <select
                          id={hrefName}
                          value={s.href}
                          onChange={(e) => update(key, s.id, { href: e.target.value })}
                          {...invalid(hrefName)}
                          className={`${selectClass} text-sm aria-[invalid=true]:border-pink-strong`}
                        >
                          <option value="">Choisir…</option>
                          {s.href && !link && <option value={s.href}>{s.href} (introuvable)</option>}
                          {links[key].map((l) => (
                            <option key={l.slug} value={`${copy.prefix}${l.slug}`}>
                              {l.name}
                              {l.note ? ` (${l.note})` : ""}
                            </option>
                          ))}
                        </select>
                        {fieldError(hrefName)}
                        {link && !link.live && (
                          <span className="mt-1 block text-xs font-normal text-ink-muted">Pas encore visible dans la boutique : la diapo n&apos;apparaîtra qu&apos;à ce moment-là.</span>
                        )}
                      </label>
                      {key === "hero" && text(key, s, "linkLabel", "Texte du bouton", HOME_LIMITS.linkLabel, "facultatif")}
                      <div className="sm:col-span-2">{text(key, s, "alt", "Description de la photo", HOME_LIMITS.alt, "lue par les lecteurs d'écran")}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <label className="mr-2 flex min-h-11 items-center gap-2 text-sm text-ink">
                      <input type="checkbox" checked={s.active} onChange={(e) => update(key, s.id, { active: e.target.checked })} className="size-5 accent-pink-strong" />
                      Diapo active
                    </label>
                    <button type="button" onClick={() => move(key, i, -1)} disabled={i === 0} aria-label={`Monter la diapo ${i + 1}`} className={secondaryButton}>
                      <ArrowUp aria-hidden className="size-4" />
                      Monter
                    </button>
                    <button type="button" onClick={() => move(key, i, 1)} disabled={i === list.length - 1} aria-label={`Descendre la diapo ${i + 1}`} className={secondaryButton}>
                      <ArrowDown aria-hidden className="size-4" />
                      Descendre
                    </button>
                    <button type="button" onClick={() => void remove(key, s)} className={`${secondaryButton} sm:ml-auto`}>
                      <Trash2 aria-hidden className="size-4" />
                      Supprimer
                    </button>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>
        {list.length < HOME_LIMITS.slides[key] ? (
          <button type="button" onClick={() => add(key)} className={`${secondaryButton} mt-4`}>
            <Plus aria-hidden className="size-4" />
            Ajouter une diapo
          </button>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">{HOME_LIMITS.slides[key]} diapos au maximum.</p>
        )}
      </Card>
    );
  };

  const picked = picking ? slides[picking.key].find((s) => s.id === picking.id) : undefined;

  return (
    <div className="space-y-6">
      <FormMessage state={resetState} />
      <form ref={form} action={action} onSubmit={(e) => void onSubmit(e)} className="space-y-6">
        <FormMessage state={state} />
        <input type="hidden" name="payload" value={JSON.stringify(slides)} />
        {carousel("hero")}
        {carousel("selection")}
        <button type="submit" disabled={pending || resetting} className={primaryButton}>
          {pending ? "Enregistrement…" : "Enregistrer l'accueil"}
        </button>
      </form>

      {stored && (
        <form ref={resetForm} action={resetAction} onSubmit={(e) => void onReset(e)}>
          <Card title="Contenu d'origine">
            <p className="text-ink-muted">Efface vos diapos et remet les carrousels prévus à la création du site.</p>
            <button type="submit" disabled={pending || resetting} className={`${secondaryButton} mt-4`}>
              <RotateCcw aria-hidden className="size-4" />
              {resetting ? "Retour en cours…" : "Revenir au contenu d'origine"}
            </button>
          </Card>
        </form>
      )}

      <ImagePicker open={!!picking} images={options.images} selected={picked?.imageSrc ?? ""} onPick={pick} onClose={() => setPicking(null)} />
      {dialog}
    </div>
  );
}
