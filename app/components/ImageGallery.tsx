"use client";

import { useState } from "react";

/**
 * Displays one or more images. Given a single URL it renders a plain <img>, so it
 * can drop into the places that previously rendered one cover image without
 * changing how those look for records that have no gallery.
 */

export type ImageGalleryProps = {
  /** Nullish and empty entries are dropped; duplicates are collapsed. */
  images: (string | null | undefined)[];
  alt?: string;
  className?: string;
  /** Tailwind height for the main image. */
  heightClass?: string;
  fallbackSrc?: string;
  /** Off for fixed-height heroes, where the strip would be clipped. */
  showThumbnails?: boolean;
};

export default function ImageGallery({
  images,
  alt = "",
  className = "",
  heightClass = "h-56",
  fallbackSrc,
  showThumbnails = true,
}: ImageGalleryProps) {
  const urls = Array.from(new Set(images.filter((u): u is string => Boolean(u && u.trim()))));
  const [active, setActive] = useState(0);

  if (urls.length === 0) {
    if (!fallbackSrc) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fallbackSrc}
        alt={alt}
        className={`w-full ${heightClass} object-cover ${className}`}
      />
    );
  }

  const index = Math.min(active, urls.length - 1);

  if (urls.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={urls[0]} alt={alt} className={`w-full ${heightClass} object-cover ${className}`} />
    );
  }

  return (
    <div className={className}>
      <div className={`relative w-full ${heightClass} overflow-hidden`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={urls[index]} alt={alt} className="h-full w-full object-cover" />

        <button
          type="button"
          aria-label="Previous photo"
          onClick={() => setActive((i) => (i - 1 + urls.length) % urls.length)}
          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next photo"
          onClick={() => setActive((i) => (i + 1) % urls.length)}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
        >
          ›
        </button>

        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
          {index + 1} / {urls.length}
        </span>
      </div>

      {showThumbnails && (
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Show photo ${i + 1}`}
            className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
              i === index ? "border-red-500" : "border-transparent opacity-60"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
