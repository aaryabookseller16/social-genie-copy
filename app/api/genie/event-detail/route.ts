import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

type EventDetailResult = {
  event?: { venue_address?: string; [key: string]: unknown };
  venue?: { latitude?: number; longitude?: number; [key: string]: unknown } | null;
  [key: string]: unknown;
};

/**
 * Ticketmaster-imported events carry `venue_id: 0` (never linked to a
 * genie_venues row), so ep_get_event_detail_dev returns `venue: null` — no
 * coordinates anywhere in the payload. Geocode the raw venue_address as a
 * fallback so the Uber ride link can still preselect a dropoff pin instead of
 * relying on Uber's own (unreliable) address-text resolution.
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== "OK") return null;

    const location = data.results?.[0]?.geometry?.location;
    if (typeof location?.lat !== "number" || typeof location?.lng !== "number") return null;

    return { lat: location.lat, lng: location.lng };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get("event_id");
    if (!eventId || isNaN(Number(eventId))) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    }

    const authToken = extractBearerToken(request);

    const result = await xanoFetch<EventDetailResult>("genie/ep_get_event_detail_dev", {
      params: { event_id: eventId },
      ...(authToken ? { authToken } : {}),
    });

    const hasCoords =
      typeof result.venue?.latitude === "number" && typeof result.venue?.longitude === "number";
    const address = result.event?.venue_address;

    if (!hasCoords && address) {
      const geocoded = await geocodeAddress(address);
      if (geocoded) {
        result.venue = { ...(result.venue ?? {}), latitude: geocoded.lat, longitude: geocoded.lng };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not load event detail." }, { status: 500 });
  }
}
