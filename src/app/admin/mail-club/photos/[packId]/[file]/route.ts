import { getSessionUser } from "@/lib/auth/dal";
import { PHOTO_FILE_PATTERN, catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { errorCode, logEvent } from "@/lib/log";
import { readPackPhoto } from "@/lib/subscriptions/pack-storage";
import { PACK_ID_PATTERN } from "@/lib/subscriptions/packs";

/** Mail Club pack photo for signed-in admins (drafts included). Anyone else gets a 404. */
const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ packId: string; file: string }> }) {
  if (!catalogAdminEnabled(process.env)) return notFound();
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return notFound();
  const { packId, file } = await params;
  if (!PACK_ID_PATTERN.test(packId) || !PHOTO_FILE_PATTERN.test(file)) return notFound();
  try {
    const data = await readPackPhoto(packId, file);
    if (!data) return notFound();
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.endsWith(".webp") ? "image/webp" : "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    logEvent("mail_club_photo_read_error", { code: errorCode(error) });
    return new Response(null, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
