// app/lib/image.ts
// Shared image helpers (venue cards + venue detail)

export const PLACEHOLDER_VENUE_IMAGE = "/placeholder-venue.png";

/**
 * Picks the best image for a venue, in priority order:
 * 1) image_primary_url (vendor-controlled later)
 * 2) image_fallback_url (seeded / scraped / Google)
 * 3) placeholder image (local asset)
 */
export function pickVenueImage(v: any): string {
  const primary = (v?.image_primary_url ?? "").toString().trim();
  if (primary) return primary;

  const fallback = (v?.image_fallback_url ?? "").toString().trim();
  if (fallback) return fallback;

  return PLACEHOLDER_VENUE_IMAGE;
}

/**
 * Normalizes a Xano `json` image column into a list of URLs.
 *
 * Xano returns an empty `json` column as `{}` rather than `[]`, and rows created
 * before the column existed have no value at all — so callers can't assume an array.
 */
export function toImageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((url): url is string => typeof url === "string" && url.trim().length > 0);
}

/**
 * The full ordered gallery for a record that has both a cover field and a gallery
 * array. The cover leads, and is not repeated if it already appears in the array.
 */
export function galleryFor(cover: unknown, images: unknown): string[] {
  const list = toImageList(images);
  const trimmedCover = typeof cover === "string" ? cover.trim() : "";
  if (!trimmedCover) return list;
  return list.includes(trimmedCover) ? list : [trimmedCover, ...list];
}

export type GalleryMediaItem =
  | { type: "image"; url: string }
  | { type: "video"; url: string; posterUrl: string };

/** Normalizes a Xano `video_urls` json column into a list of {url, thumbnail_url}. */
export function toVideoList(value: unknown): { url: string; thumbnail_url: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is { url: string; thumbnail_url: string } =>
      !!v &&
      typeof v === "object" &&
      typeof (v as Record<string, unknown>).url === "string" &&
      typeof (v as Record<string, unknown>).thumbnail_url === "string"
  );
}

/**
 * Unified, single-carousel gallery combining photos and videos. Photos lead (cover
 * first, same order as galleryFor), videos follow — image_urls and video_urls are
 * separate Xano columns, so there's no interleaved order stored server-side to
 * preserve; this is the same precedence the create/update endpoints already use for
 * picking the cover.
 */
export function mediaGalleryFor(cover: unknown, images: unknown, videos: unknown): GalleryMediaItem[] {
  const imageItems: GalleryMediaItem[] = galleryFor(cover, images).map((url) => ({ type: "image", url }));
  const videoItems: GalleryMediaItem[] = toVideoList(videos).map((v) => ({
    type: "video",
    url: v.url,
    posterUrl: v.thumbnail_url,
  }));
  return [...imageItems, ...videoItems];
}

/**
 * Optional: safe hostname extraction for remote images
 * (handy for debugging + next.config.js allowlists)
 */
export function getImageHostname(url: string): string | null {
  try {
    if (!url) return null;
    // next/image allows local paths like "/placeholder-venue.png"
    if (url.startsWith("/")) return null;
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Optional: basic "is remote image?" helper
 */
export function isRemoteImage(url: string): boolean {
  return Boolean(url) && !url.startsWith("/");
}
