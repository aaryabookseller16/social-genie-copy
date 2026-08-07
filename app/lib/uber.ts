// app/lib/uber.ts
// Builds the Uber ride-request deep link used by every "Get Ride" button.
// Always the client_id-authenticated `/looking` endpoint with exact pickup +
// dropoff pins — no Uber-side geocoding, no address-string fallback.
// Callers are responsible for having real pickup/dropoff coordinates and a
// configured NEXT_PUBLIC_UBER_CLIENT_ID before calling this.

type Coords = { lat: number; lng: number };

export function buildUberRideUrl(opts: {
  pickup: Coords;
  dropoff: Coords;
  dropoffLabel: string;
}): string {
  const clientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID ?? "";

  const pickupParam = JSON.stringify({
    latitude: opts.pickup.lat,
    longitude: opts.pickup.lng,
    addressLine1: "Current Location",
  });
  const dropParam = JSON.stringify({
    latitude: opts.dropoff.lat,
    longitude: opts.dropoff.lng,
    addressLine1: opts.dropoffLabel,
    addressLine2: opts.dropoffLabel,
  });

  return `https://m.uber.com/looking?client_id=${encodeURIComponent(clientId)}&pickup=${encodeURIComponent(pickupParam)}&drop[0]=${encodeURIComponent(dropParam)}`;
}

/**
 * Gets the browser's current position, caching it in-memory for the rest of
 * the page's lifetime (repeat Ride taps shouldn't re-prompt). Rejects if
 * geolocation is unavailable or the user denies/it times out — callers
 * decide what to do then (there is no coordinate-free Uber link anymore).
 */
let cachedPickup: Coords | null = null;

export function getPickupCoords(hint?: Coords | null): Promise<Coords> {
  if (hint) cachedPickup = hint;
  if (cachedPickup) return Promise.resolve(cachedPickup);

  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedPickup = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(cachedPickup);
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

/**
 * Opens a new tab immediately (synchronously, inside the click handler, so
 * browsers don't treat it as a blocked popup), resolves pickup coordinates
 * — an already-known one if the caller has it, otherwise a fresh
 * getCurrentPosition() call — then navigates that tab to the built Uber
 * link. If pickup can't be resolved (denied/unavailable), the blank tab is
 * closed; there's no address-only fallback anymore.
 */
export function openUberRide(opts: {
  dropoff: Coords;
  dropoffLabel: string;
  pickupHint?: Coords | null;
}): void {
  if (typeof window === "undefined") return;
  const tab = window.open("", "_blank", "noopener,noreferrer");

  getPickupCoords(opts.pickupHint)
    .then((pickup) => {
      const url = buildUberRideUrl({ pickup, dropoff: opts.dropoff, dropoffLabel: opts.dropoffLabel });
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    })
    .catch(() => {
      tab?.close();
    });
}
