"use client";

import Image from "next/image";

/**
 * One photo. Dimensions come from the build-time header scan in photos.js; when a
 * format we can't measure shows up (AVIF, anything exotic) we fall back to a plain
 * <img> so the archive still renders instead of throwing.
 */
export default function Shot({ photo, sizes, className = "", priority = false, quality }) {
  if (photo.width && photo.height) {
    return (
      <Image
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        sizes={sizes}
        className={className}
        priority={priority}
        quality={quality}
      />
    );
  }

  return (
    <img
      src={photo.src}
      alt={photo.alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
