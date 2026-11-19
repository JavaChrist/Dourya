"use client";

import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Star, Trash2 } from "lucide-react";
import { editPhotoAction, uploadPhotoAction } from "@/app/admin/catalogue/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { FormMessage, primaryButton, secondaryButton } from "@/components/account/ui";
import { inputClass } from "@/components/auth/FormParts";
import { isDraftPhotoUrl } from "@/lib/catalog/draft-photo-url";
import type { ImageAsset } from "@/lib/types";
import { resizePhoto } from "./resize";

type Item = { name: string; status: "waiting" | "resizing" | "sending" | "done" | "error"; message?: string };
const STATUS = { waiting: "En attente", resizing: "Réduction…", sending: "Envoi…", done: "Ajoutée", error: "Échec" } as const;

/** Several photos can be picked at once; they are reduced then sent one by one, each with its own status. */
function Uploader({ productId, productName, remaining }: { productId: string; productName: string; remaining: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<Item>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  async function send(files: File[]) {
    const picked = files.slice(0, Math.max(0, remaining));
    setItems([...picked.map((f) => ({ name: f.name, status: "waiting" as const })), ...files.slice(picked.length).map((f) => ({ name: f.name, status: "error" as const, message: "Limite de photos atteinte" }))]);
    if (picked.length === 0) return;
    setBusy(true);
    for (let i = 0; i < picked.length; i++) {
      try {
        set(i, { status: "resizing" });
        const photo = await resizePhoto(picked[i]);
        set(i, { status: "sending" });
        const form = new FormData();
        form.set("productId", productId);
        form.set("photo", photo.blob, `photo.${photo.kind}`);
        form.set("width", String(photo.width));
        form.set("height", String(photo.height));
        form.set("alt", productName);
        const result = await uploadPhotoAction(form);
        set(i, result.status === "ok" ? { status: "done" } : { status: "error", message: result.message });
        if (result.status !== "ok" && result.message?.includes("préversion")) break;
      } catch {
        set(i, { status: "error", message: "Photo illisible ou trop lourde" });
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-3">
      <input
        ref={input}
        id="photos"
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        disabled={busy || remaining <= 0}
        onChange={(e) => void send(Array.from(e.currentTarget.files ?? []))}
      />
      <label htmlFor="photos" className={`${primaryButton} cursor-pointer ${busy || remaining <= 0 ? "pointer-events-none opacity-60" : ""}`}>
        {busy ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <ImagePlus aria-hidden className="size-5" />}
        {busy ? "Envoi en cours…" : "Ajouter des photos"}
      </label>
      <p className="text-sm text-ink-muted">Plusieurs photos à la fois possible. Elles sont réduites sur l&apos;appareil (2000 px max), sans données de localisation.</p>
      {items.length > 0 && (
        <ul aria-live="polite" className="divide-y divide-secondary/30 rounded-2xl bg-surface-muted px-4">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate text-ink">{it.name}</span>
              <span className={it.status === "error" ? "font-bold text-pink-strong" : "text-ink-muted"}>
                {STATUS[it.status]}
                {it.message ? ` : ${it.message}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const idle: FormState = { status: "idle" };
const iconButton = "inline-flex size-11 items-center justify-center rounded-full border-2 border-secondary/50 bg-white text-ink transition hover:border-ink disabled:opacity-40";

function PhotoCard({ productId, image, index, count }: { productId: string; image: ImageAsset; index: number; count: number }) {
  const [state, action, pending] = useActionState(editPhotoAction, idle);
  const hidden = (op: string) => (
    <>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="src" value={image.src} />
      <input type="hidden" name="op" value={op} />
    </>
  );
  return (
    <li className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-secondary/30">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-muted">
        <Image src={image.src} alt={image.alt} fill sizes="(min-width: 640px) 220px, 45vw" className="object-cover" unoptimized={isDraftPhotoUrl(image.src)} />
        {index === 0 && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-ink">Couverture</span>}
      </div>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-1.5">
        <form action={action}>
          {hidden("up")}
          <button type="submit" disabled={pending || index === 0} className={iconButton} aria-label="Avancer la photo">
            <ArrowUp aria-hidden className="size-4" />
          </button>
        </form>
        <form action={action}>
          {hidden("down")}
          <button type="submit" disabled={pending || index === count - 1} className={iconButton} aria-label="Reculer la photo">
            <ArrowDown aria-hidden className="size-4" />
          </button>
        </form>
        <form action={action}>
          {hidden("cover")}
          <button type="submit" disabled={pending || index === 0} className={iconButton} aria-label="Choisir comme couverture">
            <Star aria-hidden className="size-4" />
          </button>
        </form>
        <form
          action={action}
          onSubmit={(e) => {
            if (!window.confirm(isDraftPhotoUrl(image.src) ? "Retirer cette photo ? Elle sera supprimée." : "Retirer cette photo de la fiche ? Le fichier du site reste en place.")) e.preventDefault();
          }}
        >
          {hidden("delete")}
          <button type="submit" disabled={pending} className={iconButton} aria-label="Retirer la photo">
            <Trash2 aria-hidden className="size-4" />
          </button>
        </form>
      </div>
      <form action={action} className="flex gap-1.5">
        {hidden("alt")}
        <label htmlFor={`alt-${index}`} className="sr-only">
          Description de la photo
        </label>
        <input id={`alt-${index}`} name="alt" defaultValue={image.alt} maxLength={160} className={`${inputClass} mt-0 h-11 px-3 text-sm`} />
        <button type="submit" disabled={pending} className={`${secondaryButton} px-3 text-sm`}>
          OK
        </button>
      </form>
    </li>
  );
}

export function PhotoManager({ productId, productName, images, max }: { productId: string; productName: string; images: ImageAsset[]; max: number }) {
  return (
    <div className="space-y-5">
      <Uploader productId={productId} productName={productName} remaining={max - images.length} />
      {images.length === 0 ? (
        <p className="text-ink-muted">Aucune photo pour l&apos;instant.</p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, i) => (
            <PhotoCard key={image.src} productId={productId} image={image} index={i} count={images.length} />
          ))}
        </ol>
      )}
      <p className="text-sm text-ink-muted">
        {images.length} / {max} photos. La première est la couverture.
      </p>
    </div>
  );
}
