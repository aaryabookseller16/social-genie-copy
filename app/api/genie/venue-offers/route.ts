import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";
import { type RawGenieOffer } from "@/app/lib/genieTypes";

/**
 * GET /api/genie/venue-offers?id=123 — active influencer offers for a venue.
 * Proxies to genie/ep_get_venue_offers_dev.
 */
export async function GET(request: NextRequest) {
  const venueId = request.nextUrl.searchParams.get("id") ?? "";
  if (!venueId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const response = await xanoFetch<{
      offers?: RawGenieOffer[];
      offer_count?: number;
    }>("genie/ep_get_venue_offers_dev", {
      params: { venue_id: venueId },
    });

    return NextResponse.json({ offers: response.offers ?? [] });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("GET /api/genie/venue-offers failed:", error);
    return NextResponse.json({ error: "Could not load offers." }, { status: 500 });
  }
}
