"use client";

import { editPackPhotoAction, uploadPackPhotoAction } from "@/app/admin/mail-club/actions";
import { PhotoManager, type PhotoActions } from "@/components/admin/catalog/PhotoManager";
import type { ImageAsset } from "@/lib/types";

const PACK_ACTIONS: PhotoActions = { upload: uploadPackPhotoAction, edit: editPackPhotoAction };

/** The catalogue photo manager, wired to the Mail Club pack actions (field "productId" carries the pack month). */
export function PackPhotoManager({ packId, title, images, max }: { packId: string; title: string; images: ImageAsset[]; max: number }) {
  return <PhotoManager productId={packId} productName={title} images={images} max={max} actions={PACK_ACTIONS} />;
}
