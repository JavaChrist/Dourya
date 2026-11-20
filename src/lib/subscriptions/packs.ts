import type { ImageAsset } from "@/lib/types";
import { PACK_ADMIN_PHOTO_ROUTE } from "./pack-photo-url";

/**
 * Mail Club packs: one fiche per month (id = "YYYY-MM"), with title, text and
 * photos. Pure helpers (no Firestore), unit-tested.
 *
 * The page /infos/mail-club shows the published pack of the latest month as
 * the pack of the month, and the other published packs as « Les packs
 * précédents ». A draft is never shown: the admin decides by publishing.
 */
export type PackStatus = "draft" | "published";

export type MailClubPack = {
  id: string;
  title: string;
  description: string;
  images: ImageAsset[];
  status: PackStatus;
  publishedAt: string | null;
  updatedAt: string | null;
};

export const PACK_ID_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MAX_PACK_IMAGES = 12;
export const PACK_TITLE_MAX = 120;
export const PACK_DESCRIPTION_MAX = 2000;

/** "2026-12" -> "Décembre 2026". */
export function packMonthLabel(id: string): string {
  if (!PACK_ID_PATTERN.test(id)) return id;
  const [y, m] = id.split("-").map(Number);
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Newest month first. */
export const sortPacks = (packs: MailClubPack[]): MailClubPack[] => [...packs].sort((a, b) => b.id.localeCompare(a.id));

/** Pack of the month (latest published month) and the previous published packs. */
export function splitPublished(packs: MailClubPack[]): { current: MailClubPack | null; previous: MailClubPack[] } {
  const published = sortPacks(packs.filter((p) => p.status === "published"));
  return { current: published[0] ?? null, previous: published.slice(1) };
}

export type PackMissing = "title" | "description" | "photo" | "alt";

export const PACK_MISSING_LABEL: Record<PackMissing, string> = {
  title: "un titre",
  description: "une description",
  photo: "au moins une photo",
  alt: "une description pour chaque photo",
};

/** What is still missing before the pack can be published. */
export function packReadiness(pack: Pick<MailClubPack, "title" | "description" | "images">): PackMissing[] {
  const missing: PackMissing[] = [];
  if (!pack.title.trim()) missing.push("title");
  if (!pack.description.trim()) missing.push("description");
  if (pack.images.length === 0) missing.push("photo");
  else if (pack.images.some((i) => !i.alt.trim())) missing.push("alt");
  return missing;
}

/** The file belongs to a published pack (public photo route). */
export function isPublishedPackPhoto(packs: MailClubPack[], packId: string, file: string): boolean {
  const src = `${PACK_ADMIN_PHOTO_ROUTE}/${packId}/${file}`;
  return packs.some((p) => p.id === packId && p.status === "published" && p.images.some((i) => i.src === src));
}

export type PackTextInput = { title: string; description: string };
export type PackFormResult = { ok: true; value: PackTextInput } | { ok: false; errors: Partial<Record<keyof PackTextInput, string>> };

export function validatePackText(form: FormData): PackFormResult {
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const errors: Partial<Record<keyof PackTextInput, string>> = {};
  if (!title || title.length > PACK_TITLE_MAX) errors.title = `Titre obligatoire, ${PACK_TITLE_MAX} caractères au plus.`;
  if (description.length > PACK_DESCRIPTION_MAX) errors.description = "2 000 caractères au plus.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { title, description } };
}
