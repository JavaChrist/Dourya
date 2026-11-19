import { TEST_DATABASE_ID, TEST_PREVIEW_BRANCH, firestoreDatabaseId } from "@/lib/checkout/test-preview";
import { isPlaceholder } from "@/lib/firebase/shared";
import { DRAFT_PHOTO_ROUTE } from "./draft-photo-url";

export { DRAFT_PHOTO_ROUTE, isDraftPhotoUrl } from "./draft-photo-url";

/**
 * Catalogue admin (rubriques, draft products, photos) and the stored catalogue
 * it writes. Pure (env passed in) so it can be unit-tested.
 *
 * Open only:
 * - on the Vercel preview of the `stripe-test` branch, with
 *   FIRESTORE_DATABASE_ID = `dourya-test` and a Storage bucket known; or
 * - in local `next dev` on the Firebase emulators (Firestore and Storage,
 *   "demo-" project: nothing reaches a real project).
 * Production, other previews, local builds and tests stay closed: the admin
 * pages show a notice and every write is refused. dourya.fr keeps the
 * fixture catalogue.
 */
type Env = { readonly [key: string]: string | undefined };

/** Prefix of the draft photos in Storage: outside the public `products/**`. */
export const DRAFT_PHOTO_PREFIX = "catalog-drafts";

function onEmulators(env: Env): boolean {
  return !env.VERCEL_ENV && env.NODE_ENV === "development" && !!env.FIRESTORE_EMULATOR_HOST && !!env.FIREBASE_STORAGE_EMULATOR_HOST;
}

/**
 * Bucket of the draft photos: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, else the
 * project's default bucket (`<project id>.firebasestorage.app`, the only one
 * that exists for this project). Undefined when nothing usable is set.
 */
export function catalogBucket(env: Env): string | undefined {
  const explicit = env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  if (!isPlaceholder(explicit)) return explicit;
  const projectId = (onEmulators(env) ? env.GCLOUD_PROJECT || "demo-dourya" : env.FIREBASE_ADMIN_PROJECT_ID)?.trim();
  if (isPlaceholder(projectId) || !/^[a-z0-9-]{4,40}$/.test(projectId!)) return undefined;
  return `${projectId}.firebasestorage.app`;
}

export type CatalogAdminState = { enabled: true; bucket: string } | { enabled: false; reason: "not-test-preview" | "database" | "bucket" };

export function catalogAdminState(env: Env): CatalogAdminState {
  const emulators = onEmulators(env);
  const preview = env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === TEST_PREVIEW_BRANCH;
  if (!preview && !emulators) return { enabled: false, reason: "not-test-preview" };
  if (preview && firestoreDatabaseId(env) !== TEST_DATABASE_ID) return { enabled: false, reason: "database" };
  const bucket = catalogBucket(env);
  if (!bucket) return { enabled: false, reason: "bucket" };
  return { enabled: true, bucket };
}

export const catalogAdminEnabled = (env: Env): boolean => catalogAdminState(env).enabled;

/** Draft photo ids and file names accepted by the photo route and actions. */
export const PRODUCT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,79}$/;
export const PHOTO_FILE_PATTERN = /^[a-z0-9]{8,40}\.(webp|jpg)$/;

export function draftPhotoPath(productId: string, file: string): string {
  return `${DRAFT_PHOTO_PREFIX}/${productId}/${file}`;
}

export function draftPhotoUrl(productId: string, file: string): string {
  return `${DRAFT_PHOTO_ROUTE}/${productId}/${file}`;
}
