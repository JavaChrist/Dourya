/** URL of the admin-only route that serves a draft photo (no import: usable in client components). */
export const DRAFT_PHOTO_ROUTE = "/admin/catalogue/photos";

/** Public route of the same photo, served only while its product is published (and ready) in the shop. */
export const PUBLIC_PHOTO_ROUTE = "/catalogue/photos";

export const isDraftPhotoUrl = (src: string): boolean => src.startsWith(`${DRAFT_PHOTO_ROUTE}/`);

export const isPublicPhotoUrl = (src: string): boolean => src.startsWith(`${PUBLIC_PHOTO_ROUTE}/`);

/** A photo uploaded through the admin (already resized by the browser: next/image does not optimise it again). */
export const isUploadedPhotoUrl = (src: string): boolean => isDraftPhotoUrl(src) || isPublicPhotoUrl(src);

/** Public URL of an uploaded photo; the other paths (/images/products/**) are returned as is. */
export const toPublicPhotoUrl = (src: string): string => (isDraftPhotoUrl(src) ? `${PUBLIC_PHOTO_ROUTE}${src.slice(DRAFT_PHOTO_ROUTE.length)}` : src);
