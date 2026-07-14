/**
 * Shared geo helpers — Haversine distance + locale-based unit detection.
 * Originally lived only in single-page/ui.tsx for venues; extracted so the
 * Events page can compute "near me" distance/sorting the same way.
 */

export function computeDistance(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  useMetric: boolean
): number {
  const R = useMetric ? 6371 : 3958.8; // Earth radius
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(targetLat - userLat);
  const dLng = toRad(targetLng - userLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userLat)) *
      Math.cos(toRad(targetLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function shouldUseMetric(): boolean {
  if (typeof navigator === "undefined") return false;
  const locale = navigator.language || "en-US";
  return !["en-US", "en-GB", "my-MM"].includes(locale);
}

export function formatDistance(distance: number, useMetric: boolean): string {
  const unit = useMetric ? "km" : "mi";
  if (distance < 0.1) return `Less than 0.1 ${unit}`;
  if (distance < 10) return `${distance.toFixed(1)} ${unit}`;
  return `${Math.round(distance)} ${unit}`;
}

/**
 * Real-world distance label between the user and a lat/lng point. Returns
 * `null` when either coordinate pair is unavailable so callers can hide the
 * distance entirely instead of showing a misleading number.
 */
export function getDistanceLabel(
  userCoords: { lat: number; lng: number } | null | undefined,
  targetLat: number | null | undefined,
  targetLng: number | null | undefined
): string | null {
  if (
    !userCoords ||
    !Number.isFinite(userCoords.lat) ||
    !Number.isFinite(userCoords.lng) ||
    typeof targetLat !== "number" ||
    typeof targetLng !== "number"
  ) {
    return null;
  }

  const useMetric = shouldUseMetric();
  const distance = computeDistance(userCoords.lat, userCoords.lng, targetLat, targetLng, useMetric);
  return formatDistance(distance, useMetric);
}

/**
 * Raw distance in miles, for sorting only (unit doesn't affect relative
 * order, so this always uses statute miles regardless of locale).
 */
export function getDistanceMiles(
  userCoords: { lat: number; lng: number } | null | undefined,
  targetLat: number | null | undefined,
  targetLng: number | null | undefined
): number | null {
  if (
    !userCoords ||
    !Number.isFinite(userCoords.lat) ||
    !Number.isFinite(userCoords.lng) ||
    typeof targetLat !== "number" ||
    typeof targetLng !== "number"
  ) {
    return null;
  }
  return computeDistance(userCoords.lat, userCoords.lng, targetLat, targetLng, false);
}
