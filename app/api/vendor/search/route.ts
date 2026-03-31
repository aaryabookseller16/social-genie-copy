import { NextRequest, NextResponse } from "next/server";

import { mapVenue } from "@/app/lib/genieMappers";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";
import { searchCatalogVenues } from "@/app/lib/server/xanoCatalog";

export async function GET(request: NextRequest) {
  const { auth, errorResponse } = await requireAuthenticatedUser(request);
  if (!auth) {
    return errorResponse;
  }

  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchCatalogVenues(query, 8);
  return NextResponse.json({
    results: results.map(mapVenue),
  });
}
