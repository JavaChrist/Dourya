import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { adminDb } from "@/lib/firebase/admin-db";
import { errorCode, logEvent } from "@/lib/log";
import { parseStoredCarousels, type HomeCarousels } from "./carousels";

/**
 * Home carousels composed in Admin → Accueil: one document, settings/home
 * (refused to clients by firestore.rules, catch-all). Read and written only
 * where the admin is open (admin-gate.ts: dourya.fr, the stripe-test preview,
 * local emulators); elsewhere the home keeps src/data/home.ts.
 */
export const HOME_TAG = "home";
const doc = () => adminDb().collection("settings").doc("home");

/** Fresh read for the admin page: the stored carousels and when they were saved, or null. */
export async function readHomeCarousels(): Promise<{ carousels: HomeCarousels; updatedAt: string | null } | null> {
  const snap = await doc().get();
  if (!snap.exists) return null;
  const carousels = parseStoredCarousels(snap.data());
  if (!carousels) return null;
  const at = snap.get("updatedAt");
  return { carousels, updatedAt: typeof at === "string" ? at : null };
}

/** Cached read for the home page. The admin actions expire the "home" tag after each write. */
async function cachedHomeCarousels(): Promise<HomeCarousels | null> {
  "use cache";
  cacheTag(HOME_TAG);
  cacheLife("max");
  return (await readHomeCarousels())?.carousels ?? null;
}

/** Carousels for the home page, or null (keep home.ts): admin closed here, nothing stored, or the read failed. */
export async function homeCarouselsForShop(): Promise<HomeCarousels | null> {
  if (!catalogAdminEnabled(process.env)) return null;
  try {
    return await cachedHomeCarousels();
  } catch (error) {
    logEvent("home_carousels_read_error", { code: errorCode(error) });
    return null;
  }
}

/** Replaces the whole document. The caller has validated the carousels (validateHomeInput). Records who (uid) and when. */
export async function saveHomeCarousels(carousels: HomeCarousels, adminUid: string, now = new Date()): Promise<void> {
  await doc().set({
    hero: carousels.hero.map((s) => ({ ...s, image: { ...s.image } })),
    selection: carousels.selection.map((s) => ({ ...s, image: { ...s.image } })),
    updatedAt: now.toISOString(),
    updatedBy: adminUid,
  });
}

/** Back to the carousels of the code (src/data/home.ts). */
export async function resetHomeCarousels(): Promise<void> {
  await doc().delete();
}
