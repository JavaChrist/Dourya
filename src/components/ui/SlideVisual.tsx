import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { isUploadedPhotoUrl } from "@/lib/catalog/draft-photo-url";
import type { Slide } from "@/lib/types";
import { backgroundProps } from "./Section";

/**
 * Shows the slide image, or a clearly labelled demo visual on a DOURYA
 * background when no real photo exists yet. Product photos are shown whole
 * (`contain`, on white); the home banners keep `cover`.
 */
export function SlideVisual({
  slide,
  sizes,
  priority = false,
  fit = "contain",
  className = "",
}: {
  slide: Slide;
  sizes: string;
  priority?: boolean;
  fit?: "contain" | "cover";
  className?: string;
}) {
  if (slide.image) {
    return (
      <Image
        src={slide.image.src}
        alt={slide.image.alt}
        fill
        sizes={sizes}
        priority={priority}
        // Draft photos (catalogue admin) are served to signed-in admins only: never through the optimizer.
        unoptimized={isUploadedPhotoUrl(slide.image.src)}
        className={`${fit === "contain" ? "bg-white object-contain" : "object-cover"} ${className}`}
      />
    );
  }
  const bg = backgroundProps(slide.background ?? { kind: "grid" });
  return (
    <div
      className={`absolute inset-0 flex items-start justify-end p-3 ${bg.className} ${className}`}
      style={bg.style}
      role="img"
      aria-label="Visuel de démonstration"
    >
      <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-ink shadow-sm">
        <ImageIcon aria-hidden className="size-4 text-pink-strong" />
        <span className="text-xs font-semibold">Visuel de démonstration</span>
      </div>
    </div>
  );
}
