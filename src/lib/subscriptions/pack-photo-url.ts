/** Routes of the Mail Club pack photos (no import: usable in client components). */
export const PACK_ADMIN_PHOTO_ROUTE = "/admin/mail-club/photos";

/** Public route of the same photo, served only while its pack is published. */
export const PACK_PUBLIC_PHOTO_ROUTE = "/mail-club/photos";

export const isPackAdminPhotoUrl = (src: string): boolean => src.startsWith(`${PACK_ADMIN_PHOTO_ROUTE}/`);

/** Public URL of a pack photo stored with its admin URL. */
export const toPublicPackPhotoUrl = (src: string): string =>
  isPackAdminPhotoUrl(src) ? `${PACK_PUBLIC_PHOTO_ROUTE}${src.slice(PACK_ADMIN_PHOTO_ROUTE.length)}` : src;
