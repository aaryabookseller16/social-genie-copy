import { NextRequest, NextResponse } from "next/server";

import { mapVenue } from "@/app/lib/genieMappers";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";
import { fetchCatalogVenuesByIds } from "@/app/lib/server/xanoCatalog";

export async function GET(request: NextRequest) {
  const { auth, errorResponse } = await requireAuthenticatedUser(request);
  if (!auth) {
    return errorResponse;
  }

  const venues = await fetchCatalogVenuesByIds(auth.user.saved_venue_ids);
  const venueMap = new Map(venues.map((venue) => [String(venue.id), venue]));
  const orderedVenues = auth.user.saved_venue_ids
    .map((id) => venueMap.get(String(id)))
    .filter((venue): venue is NonNullable<typeof venue> => Boolean(venue));

  return NextResponse.json({
    venues: orderedVenues.map(mapVenue),
  });
}
