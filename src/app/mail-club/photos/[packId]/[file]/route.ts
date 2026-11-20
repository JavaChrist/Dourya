import { PHOTO_FILE_PATTERN, catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { errorCode, logEvent } from "@/lib/log";
import { readPackPhoto } from "@/lib/subscriptions/pack-storage";
import { PACK_ID_PATTERN, isPublishedPackPhoto } from "@/lib/subscriptions/packs";
import { getPack } from "@/lib/subscriptions/packs-repository";

/**
 * Public photo of a published Mail Club pack. Read with the Admin SDK only
 * when the pack is published and the photo is one of its images; a draft, a
 * removed photo or a guessed name is a 404.
 */
const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

export async function GET(_request: Request, { params }: { params: Promise<{ packId: string; file: string }> }) {
  if (!catalogAdminEnabled(process.env)) return notFound();
  const { packId, file } = await params;
  if (!PACK_ID_PATTERN.test(packId) || !PHOTO_FILE_PATTERN.test(file)) return notFound();
  try {
    const pack = await getPack(packId);
    if (!pack || !isPublishedPackPhoto([pack], packId, file)) return notFound();
    const data = await readPackPhoto(packId, file);
    if (!data) return notFound();
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.endsWith(".webp") ? "image/webp" : "image/jpeg",
        // Short: a pack put back to draft stops being served within minutes.
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    logEvent("mail_club_public_photo_error", { code: errorCode(error) });
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
