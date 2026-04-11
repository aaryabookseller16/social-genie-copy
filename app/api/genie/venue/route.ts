import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";
import { mapVenue } from "@/app/lib/genieMappers";
import { type RawGenieVenue } from "@/app/lib/genieTypes";

/**
 * GET /api/genie/venue?id=123 — get full venue detail
 */
export async function GET(request: NextRequest) {
  try {
    const venueId = request.nextUrl.searchParams.get("id") ?? "";
    if (!venueId) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const venue = await xanoFetch<RawGenieVenue>("genie/venue", {
      params: { id: venueId },
    });

    return NextResponse.json({
      venue: mapVenue(venue),
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/genie/venue failed:", error);
    return NextResponse.json(
      { error: "Could not load venue." },
      { status: 500 }
    );
  }
}
