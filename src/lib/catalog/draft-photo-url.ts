/** URL of the admin-only route that serves a draft photo (no import: usable in client components). */
export const DRAFT_PHOTO_ROUTE = "/admin/catalogue/photos";

export const isDraftPhotoUrl = (src: string): boolean => src.startsWith(`${DRAFT_PHOTO_ROUTE}/`);
