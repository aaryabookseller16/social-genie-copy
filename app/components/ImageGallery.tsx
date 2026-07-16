"use client";

import { useState } from "react";
import { type GalleryMediaItem } from "@/app/lib/image";

/**
 * Displays one or more images and/or videos as a single carousel. Given a single
 * item it renders that item bare (no arrows/thumbnails), so it can drop into the
 * places that previously rendered one cover image without changing how those look
 * for records that have no gallery.
 */

export type ImageGalleryProps = {
  /** Legacy, image-only path. Nullish and empty entries are dropped; duplicates collapsed. */
  images?: (string | null | undefined)[];
  /** Mixed photo/video gallery, in display order. Takes precedence over `images` when given. */
  items?: GalleryMediaItem[];
  alt?: string;
  className?: string;
  /** Tailwind height for the main image/video. */
  heightClass?: string;
  fallbackSrc?: string;
  /** Off for fixed-height heroes, where the strip would be clipped. */
  showThumbnails?: boolean;
};

function dedupe(items: GalleryMediaItem[]): GalleryMediaItem[] {
  const seen = new Set<string>();
  const out: GalleryMediaItem[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

export default function ImageGallery({
  images,
  items,
  alt = "",
  className = "",
  heightClass = "h-56",
  fallbackSrc,
  showThumbnails = true,
}: ImageGalleryProps) {
  const media = dedupe(
    items ??
      (images ?? [])
        .filter((u): u is string => Boolean(u && u.trim()))
        .map((url) => ({ type: "image" as const, url }))
  );
  const [active, setActive] = useState(0);

  if (media.length === 0) {
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

  const index = Math.min(active, media.length - 1);
  const current = media[index];

  if (media.length === 1) {
    return current.type === "video" ? (
      <video
        src={current.url}
        poster={current.posterUrl}
        controls
        playsInline
        // object-contain, not object-cover: a portrait/vertical (Instagram-style)
        // video inside this landscape-ish box would otherwise get zoomed in and
        // cropped top-to-bottom. bg-black makes the letterbox bars look intentional.
        className={`w-full ${heightClass} bg-black object-contain ${className}`}
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={current.url} alt={alt} className={`w-full ${heightClass} object-cover ${className}`} />
    );
  }

  return (
    <div className={className}>
      <div className={`relative w-full ${heightClass} overflow-hidden`}>
        {current.type === "video" ? (
          <video
            key={current.url}
            src={current.url}
            poster={current.posterUrl}
            controls
            playsInline
            // object-contain + bg-black: same letterboxing reasoning as the
            // single-item case above, for portrait/vertical video sources.
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={alt} className="h-full w-full object-cover" />
        )}

        <button
          type="button"
          aria-label="Previous"
          onClick={() => setActive((i) => (i - 1 + media.length) % media.length)}
          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => setActive((i) => (i + 1) % media.length)}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
        >
          ›
        </button>

        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
          {index + 1} / {media.length}
        </span>
      </div>

      {showThumbnails && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {media.map((item, i) => (
            <button
              key={item.url}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show ${item.type === "video" ? "video" : "photo"} ${i + 1}`}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === index ? "border-red-500" : "border-transparent opacity-60"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.type === "video" ? item.posterUrl : item.url}
                alt=""
                className="h-full w-full object-cover"
              />
              {item.type === "video" && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] leading-none text-white">
                    ▶
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
