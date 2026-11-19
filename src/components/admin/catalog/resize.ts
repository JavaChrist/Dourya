/**
 * Browser-side reduction of a photo before upload: max 2000 px, WebP (JPEG
 * when the browser cannot encode WebP, e.g. older Safari), re-encoded on a
 * canvas, which drops the EXIF data (GPS position...). The orientation of
 * phone photos is applied first.
 */
export const MAX_SIDE = 2000;
export const TARGET_BYTES = 850 * 1024;

export type Resized = { blob: Blob; kind: "webp" | "jpg"; width: number; height: number };

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

export async function resizePhoto(file: File): Promise<Resized> {
  const source = await decode(file);
  const w0 = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h0 = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!w0 || !h0) throw new Error("decode");
  let scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const canvas = document.createElement("canvas");
  for (let attempt = 0; attempt < 6; attempt++) {
    const width = Math.max(16, Math.round(w0 * scale));
    const height = Math.max(16, Math.round(h0 * scale));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(source, 0, 0, width, height);
    for (const quality of [0.85, 0.75, 0.65]) {
      let blob = await toBlob(canvas, "image/webp", quality);
      let kind: "webp" | "jpg" = "webp";
      if (!blob || blob.type !== "image/webp") {
        blob = await toBlob(canvas, "image/jpeg", quality);
        kind = "jpg";
      }
      if (blob && blob.size <= TARGET_BYTES) {
        if ("close" in source) source.close();
        return { blob, kind, width, height };
      }
    }
    scale *= 0.8;
  }
  throw new Error("too-large");
}
