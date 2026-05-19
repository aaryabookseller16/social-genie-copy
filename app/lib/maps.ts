// app/lib/maps.ts
// Phase 1 hardening:
// - Keep googleMapsOpenUrl for reliable “Directions / Open in Maps” links (no API key required)
// - Deprecate googleStaticMapUrl in favor of Xano-provided venue.map.static_map_url
// - Provide a safe helper to consume backend map objects + a backward-compatible adapter

export type VenueMap = {
  static_map_url?: string | null;
  maps_open_url?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/**
 * Builds a Google Maps "open" URL from address text (no API key required).
 * Prefer using backend-provided `venue.map.maps_open_url` when available.
 */
export function googleMapsOpenUrl(address?: string | null) {
  const q = (address || "").trim();
  if (!q) return "https://www.google.com/maps";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * Returns the best "open in maps" URL for a venue.
 * Priority:
 * 1) backend map object maps_open_url
 * 2) fallback to address-based open url
 */
export function venueMapsOpenUrl(opts: {
  map?: VenueMap | null;
  address?: string | null;
}) {
  const m = opts.map;
  const open = (m?.maps_open_url || "").trim();
  if (open) return open;
  return googleMapsOpenUrl(opts.address);
}

/**
 * Returns the static map URL for a venue.
 * Phase 1: Prefer backend (Xano) constructed `map.static_map_url`.
 * If not present, returns null (UI should show a graceful fallback with an "Open in Google Maps" button).
 */
export function venueStaticMapUrl(opts: { map?: VenueMap | null }) {
  const u = (opts.map?.static_map_url || "").trim();
  return u ? u : null;
}

/**
 * Backward-compat adapter:
 * If you still have legacy code calling googleStaticMapUrl(address),
 * this returns null by default to force migration to backend-provided URLs.
 *
 * If you truly need a temporary client-side builder, set:
 * NEXT_PUBLIC_ENABLE_CLIENT_STATIC_MAPS="true"
 * and provide NEXT_PUBLIC_GOOGLE_MAPS_KEY.
 *
 * NOTE: This is intentionally gated to prevent production reliance.
 */
export function googleStaticMapUrl(address?: string | null) {
  const enable = (process.env.NEXT_PUBLIC_ENABLE_CLIENT_STATIC_MAPS || "").trim() === "true";
  if (!enable) return null;

  const key = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "").trim();
  const q = (address || "").trim();

  if (!key || !q) return null;

  const size = "900x420";
  const zoom = 15;

  // Address-based static maps are less reliable than lat/lng.
  // Use only as a temporary fallback during migration.
  const center = encodeURIComponent(q);
  const markers = encodeURIComponent(`color:red|${q}`);

  return `https://maps.googleapis.com/maps/api/staticmap?size=${size}&zoom=${zoom}&scale=2&maptype=roadmap&center=${center}&markers=${markers}&key=${key}`;
}
