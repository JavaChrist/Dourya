import "server-only";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase/admin-app";
import { catalogAdminState, draftPhotoPath } from "./admin-gate";

/**
 * Draft photos of the catalogue admin, in Storage under `catalog-drafts/`
 * (outside the public `products/**`; storage.rules refuses every client).
 * Only reachable while the catalogue admin is open (stripe-test preview).
 */
export class CatalogClosedError extends Error {
  constructor() {
    super("Catalogue admin closed here.");
    this.name = "CatalogClosedError";
  }
}

function bucket() {
  const state = catalogAdminState(process.env);
  if (!state.enabled) throw new CatalogClosedError();
  return getStorage(adminApp()).bucket(state.bucket);
}

const CONTENT_TYPE = { webp: "image/webp", jpg: "image/jpeg" } as const;

export async function saveDraftPhoto(productId: string, file: string, kind: "webp" | "jpg", bytes: Uint8Array): Promise<string> {
  const path = draftPhotoPath(productId, file);
  await bucket().file(path).save(Buffer.from(bytes), {
    resumable: false,
    contentType: CONTENT_TYPE[kind],
    metadata: { cacheControl: "private, max-age=0, no-store" },
  });
  return path;
}

export async function readDraftPhoto(productId: string, file: string): Promise<Buffer | null> {
  const ref = bucket().file(draftPhotoPath(productId, file));
  const [exists] = await ref.exists();
  if (!exists) return null;
  const [data] = await ref.download();
  return data;
}

export async function deleteDraftPhoto(storagePath: string): Promise<void> {
  await bucket().file(storagePath).delete({ ignoreNotFound: true });
}
