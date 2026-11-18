import Image from "next/image";
import logo from "../../../public/brand/logo.png";
import logoFull from "../../../public/brand/logo-full.png";

/** Original DOURYA logos (white). Always place them on a pink background. */
export function Logo({
  variant = "short",
  className = "",
  priority = false,
}: {
  variant?: "short" | "full";
  className?: string;
  priority?: boolean;
}) {
  const src = variant === "full" ? logoFull : logo;
  return (
    <Image
      src={src}
      alt="DOURYA"
      priority={priority}
      className={`h-auto ${className}`}
      sizes="(max-width: 640px) 160px, 240px"
    />
  );
}
