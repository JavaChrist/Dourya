import "server-only";
import { getStorage } from "firebase-admin/storage";
import { catalogAdminState } from "@/lib/catalog/admin-gate";
import { CatalogClosedError } from "@/lib/catalog/admin-storage";
import { adminApp } from "@/lib/firebase/admin-app";

/**
 * Photos of the Mail Club packs, in Storage under `mail-club-packs/` (same
 * bucket as the catalogue admin; storage.rules refuses every client). Written
 * and read by the server only: served to admins by /admin/mail-club/photos/**
 * and to everyone by /mail-club/photos/** once the pack is published.
 */
export const PACK_PHOTO_PREFIX = "mail-club-packs";

function bucket() {
  const state = catalogAdminState(process.env);
  if (!state.enabled) throw new CatalogClosedError();
  return getStorage(adminApp()).bucket(state.bucket);
}

const CONTENT_TYPE = { webp: "image/webp", jpg: "image/jpeg" } as const;

export const packPhotoPath = (packId: string, file: string) => `${PACK_PHOTO_PREFIX}/${packId}/${file}`;

export async function savePackPhoto(packId: string, file: string, kind: "webp" | "jpg", bytes: Uint8Array): Promise<string> {
  const path = packPhotoPath(packId, file);
  await bucket().file(path).save(Buffer.from(bytes), {
    resumable: false,
    contentType: CONTENT_TYPE[kind],
    metadata: { cacheControl: "private, max-age=0, no-store" },
  });
  return path;
}

export async function readPackPhoto(packId: string, file: string): Promise<Buffer | null> {
  const ref = bucket().file(packPhotoPath(packId, file));
  const [exists] = await ref.exists();
  if (!exists) return null;
  const [data] = await ref.download();
  return data;
}

export async function deletePackPhoto(storagePath: string): Promise<void> {
  if (!storagePath.startsWith(`${PACK_PHOTO_PREFIX}/`)) return;
  await bucket().file(storagePath).delete({ ignoreNotFound: true });
}
