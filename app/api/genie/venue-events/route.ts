import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";
import { type RawGenieEvent } from "@/app/lib/genieTypes";

/**
 * GET /api/genie/venue-events?id=123 — upcoming events (next 30 days) at a venue.
 * Proxies to genie/ep_get_venue_events_dev.
 */
export async function GET(request: NextRequest) {
  const venueId = request.nextUrl.searchParams.get("id") ?? "";
  if (!venueId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const response = await xanoFetch<{
      events?: RawGenieEvent[];
      event_count?: number;
    }>("genie/ep_get_venue_events_dev", {
      params: { venue_id: venueId },
    });

    return NextResponse.json({ events: response.events ?? [] });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("GET /api/genie/venue-events failed:", error);
    return NextResponse.json({ error: "Could not load events." }, { status: 500 });
  }
}
