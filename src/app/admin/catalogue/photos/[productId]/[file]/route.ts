import { getSessionUser } from "@/lib/auth/dal";
import { PHOTO_FILE_PATTERN, PRODUCT_ID_PATTERN, catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { readDraftPhoto } from "@/lib/catalog/admin-storage";
import { errorCode, logEvent } from "@/lib/log";

/**
 * Draft photo of the catalogue admin, for signed-in admins only, on the
 * stripe-test preview only. Anyone else gets a 404 (the route is not revealed).
 */
const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string; file: string }> }) {
  if (!catalogAdminEnabled(process.env)) return notFound();
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return notFound();
  const { productId, file } = await params;
  if (!PRODUCT_ID_PATTERN.test(productId) || !PHOTO_FILE_PATTERN.test(file)) return notFound();
  try {
    const data = await readDraftPhoto(productId, file);
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
    logEvent("catalog_photo_read_error", { code: errorCode(error) });
    return new Response(null, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
