import "server-only";
import { randomBytes } from "node:crypto";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { CatalogRefusal } from "@/lib/catalog/admin-repository";
import { adminDb } from "@/lib/firebase/admin-db";
import type { ImageAsset } from "@/lib/types";
import { PACK_ADMIN_PHOTO_ROUTE } from "./pack-photo-url";
import { deletePackPhoto, savePackPhoto } from "./pack-storage";
import { MAX_PACK_IMAGES, PACK_MISSING_LABEL, packReadiness, sortPacks, type MailClubPack, type PackStatus, type PackTextInput } from "./packs";

/**
 * mailClubPacks/{YYYY-MM}: one fiche per month (title, text, photos, status),
 * written by the server only (Admin SDK; firestore.rules refuses the browser).
 */
const packs = () => adminDb().collection("mailClubPacks");

const iso = (v: unknown): string | null => (v instanceof Timestamp ? v.toDate().toISOString() : null);

function toImages(v: unknown): ImageAsset[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i): i is ImageAsset => !!i && typeof i.src === "string" && typeof i.width === "number" && typeof i.height === "number")
    .map((i) => ({ src: i.src, alt: typeof i.alt === "string" ? i.alt : "", width: i.width, height: i.height, ...(typeof i.storagePath === "string" ? { storagePath: i.storagePath } : {}) }));
}

function toPack(id: string, d: DocumentData): MailClubPack {
  return {
    id,
    title: typeof d.title === "string" ? d.title : "",
    description: typeof d.description === "string" ? d.description : "",
    images: toImages(d.images),
    status: d.status === "published" ? "published" : "draft",
    publishedAt: iso(d.publishedAt),
    updatedAt: iso(d.updatedAt),
  };
}

/** All packs, newest month first (a few per year: no index, sorted here). */
export async function listPacks(): Promise<MailClubPack[]> {
  const snap = await packs().limit(240).get();
  return sortPacks(snap.docs.map((d) => toPack(d.id, d.data())));
}

export async function getPack(id: string): Promise<MailClubPack | null> {
  const snap = await packs().doc(id).get();
  return snap.exists ? toPack(snap.id, snap.data()!) : null;
}

/** New draft for a month. Refused when that month already has a fiche. */
export async function createPack(id: string, title: string, adminUid: string, now: Date): Promise<void> {
  const at = Timestamp.fromDate(now);
  try {
    await packs().doc(id).create({ title, description: "", images: [], status: "draft", createdAt: at, updatedAt: at, updatedBy: adminUid });
  } catch (error) {
    // gRPC 6 = ALREADY_EXISTS
    if ((error as { code?: unknown })?.code === 6) throw new CatalogRefusal("Ce mois a déjà une fiche : modifiez-la dans la liste.");
    throw error;
  }
}

async function update(id: string, change: (pack: MailClubPack) => Partial<DocumentData>, adminUid: string): Promise<MailClubPack> {
  const ref = packs().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new CatalogRefusal("Fiche introuvable.");
    const pack = toPack(snap.id, snap.data()!);
    const patch = change(pack);
    tx.update(ref, { ...patch, updatedAt: Timestamp.now(), updatedBy: adminUid });
    return pack;
  });
}

/**
 * Title and text. A published pack that loses a required field goes back to
 * draft. Returns true when that happened.
 */
export async function savePackText(id: string, input: PackTextInput, adminUid: string): Promise<boolean> {
  let unpublished = false;
  await update(
    id,
    (pack) => {
      unpublished = pack.status === "published" && packReadiness({ ...pack, ...input }).length > 0;
      return { ...input, ...(unpublished ? { status: "draft" } : {}) };
    },
    adminUid,
  );
  return unpublished;
}

/** « Publier » checks the fiche again here; « Repasser en brouillon » hides it. */
export async function setPackStatus(id: string, status: PackStatus, adminUid: string, now: Date): Promise<void> {
  await update(
    id,
    (pack) => {
      if (status === "published") {
        const missing = packReadiness(pack);
        if (missing.length) throw new CatalogRefusal(`Il manque ${missing.map((m) => PACK_MISSING_LABEL[m]).join(", ")}.`);
        return { status, publishedAt: Timestamp.fromDate(now) };
      }
      return { status };
    },
    adminUid,
  );
}

export async function addPackPhoto(id: string, kind: "webp" | "jpg", bytes: Uint8Array, size: { width: number; height: number }, alt: string, adminUid: string): Promise<void> {
  const current = await getPack(id);
  if (!current) throw new CatalogRefusal("Fiche introuvable.");
  if (current.images.length >= MAX_PACK_IMAGES) throw new CatalogRefusal(`${MAX_PACK_IMAGES} photos au maximum par pack.`);
  const file = `${randomBytes(12).toString("hex")}.${kind}`;
  const storagePath = await savePackPhoto(id, file, kind, bytes);
  try {
    await update(
      id,
      (pack) => {
        if (pack.images.length >= MAX_PACK_IMAGES) throw new CatalogRefusal(`${MAX_PACK_IMAGES} photos au maximum par pack.`);
        const image: ImageAsset = { src: `${PACK_ADMIN_PHOTO_ROUTE}/${id}/${file}`, alt: alt || pack.title, width: size.width, height: size.height, storagePath };
        return { images: [...pack.images, image] };
      },
      adminUid,
    );
  } catch (error) {
    await deletePackPhoto(storagePath).catch(() => undefined);
    throw error;
  }
}

export type PackPhotoEdit = { op: "up" | "down" | "cover" | "delete" } | { op: "alt"; alt: string };

/** Reorder, cover, alt text or delete. A published pack left without a valid photo goes back to draft. */
export async function editPackPhoto(id: string, src: string, edit: PackPhotoEdit, adminUid: string): Promise<boolean> {
  let removed: ImageAsset | undefined;
  let unpublished = false;
  await update(
    id,
    (pack) => {
      const i = pack.images.findIndex((img) => img.src === src);
      if (i < 0) throw new CatalogRefusal("Photo introuvable.");
      const next = [...pack.images];
      const swap = (a: number, b: number) => ([next[a], next[b]] = [next[b], next[a]]);
      if (edit.op === "up" && i > 0) swap(i, i - 1);
      else if (edit.op === "down" && i < next.length - 1) swap(i, i + 1);
      else if (edit.op === "cover" && i > 0) next.unshift(...next.splice(i, 1));
      else if (edit.op === "alt") next[i] = { ...next[i], alt: edit.alt };
      else if (edit.op === "delete") removed = next.splice(i, 1)[0];
      unpublished = pack.status === "published" && packReadiness({ ...pack, images: next }).length > 0;
      return { images: next, ...(unpublished ? { status: "draft" } : {}) };
    },
    adminUid,
  );
  if (removed?.storagePath) await deletePackPhoto(removed.storagePath);
  return unpublished;
}
