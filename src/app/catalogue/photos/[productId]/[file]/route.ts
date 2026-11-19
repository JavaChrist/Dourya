import { getListedProducts } from "@/lib/catalog";
import { PHOTO_FILE_PATTERN, PRODUCT_ID_PATTERN, catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { readDraftPhoto } from "@/lib/catalog/admin-storage";
import { isListedPhoto } from "@/lib/catalog/publish";
import { errorCode, logEvent } from "@/lib/log";

/**
 * Public photo of a product published through the catalogue admin. The file
 * stays where the admin put it (Storage `catalog-drafts/`, private bucket
 * rules unchanged): this route reads it with the Admin SDK only when the
 * product is listed in the shop right now (published, ready, in a visible
 * rubrique) and the photo is one of its images. Anything else is a 404: a
 * draft, an archived product, a photo removed from the product, a guessed name.
 */
const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string; file: string }> }) {
  if (!catalogAdminEnabled(process.env)) return notFound();
  const { productId, file } = await params;
  if (!PRODUCT_ID_PATTERN.test(productId) || !PHOTO_FILE_PATTERN.test(file)) return notFound();
  try {
    if (!isListedPhoto(await getListedProducts(), productId, file)) return notFound();
    const data = await readDraftPhoto(productId, file);
    if (!data) return notFound();
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.endsWith(".webp") ? "image/webp" : "image/jpeg",
        // Short: an unpublished product's photos stop being served within minutes.
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    logEvent("catalog_public_photo_error", { code: errorCode(error) });
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
