import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";
import { fetchCatalogVenueById } from "@/app/lib/server/xanoCatalog";
import { mapVenue } from "@/app/lib/genieMappers";
import { type RawGenieVenue } from "@/app/lib/genieTypes";

/**
 * GET /api/genie/venue?id=123 — get full venue detail
 *
 * Tries the dedicated `genie/venue` Xano endpoint first. If that returns
 * not-found (or otherwise fails), falls back to scanning the genie_v1
 * catalog by ID — the same source the message endpoint uses, so any venue
 * surfaced in search results is resolvable here too.
 */
export async function GET(request: NextRequest) {
  const venueId = request.nextUrl.searchParams.get("id") ?? "";
  if (!venueId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Optional — resolves venue.is_saved for the caller. Omitted for guests
  // with no session yet.
  const userId = request.nextUrl.searchParams.get("user_id");
  const sessionId = request.nextUrl.searchParams.get("session_id");

  try {
    const response = await xanoFetch<{
      venue?: RawGenieVenue;
      success?: boolean;
      error?: string | null;
    }>("genie/ep_get_venue_dev", {
      params: {
        venue_id: venueId,
        ...(userId ? { user_id: userId } : {}),
        ...(sessionId ? { session_id: sessionId } : {}),
      },
    });

    if (response.venue) {
      return NextResponse.json({ venue: mapVenue(response.venue) });
    }

    if (response.error) {
      throw new XanoError(404, { message: response.error });
    }

    throw new XanoError(404, { message: "Venue not found" });
  } catch (error) {
    const isNotFound =
      error instanceof XanoError && (error.status === 404 || error.status === 400);

    if (!isNotFound && !(error instanceof XanoError)) {
      console.error("GET /api/genie/venue primary lookup failed:", error);
    }

    try {
      const fallback = await fetchCatalogVenueById(venueId);
      if (fallback) {
        return NextResponse.json({ venue: mapVenue(fallback) });
      }
    } catch (fallbackError) {
      console.error("GET /api/genie/venue catalog fallback failed:", fallbackError);
    }

    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Could not load venue." },
      { status: 500 }
    );
  }
}
