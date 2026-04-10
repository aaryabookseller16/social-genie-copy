import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";
import { mapVenue } from "@/app/lib/genieMappers";

/**
 * GET /api/vendor/search?query=X
 * Proxies to genie/vendor_search?query=X&city=...
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
    const city = request.nextUrl.searchParams.get("city")?.trim() ?? "Houston";
    if (query.length < 2) {
      return NextResponse.json({ results: [], count: 0 });
    }

    const result = await xanoFetch<{
      results: Array<{
        id: number;
        venue_name: string;
        address: string;
        area_neighborhood: string;
        city: string;
      }>;
      count: number;
      query: string;
    }>("genie/vendor_search", {
      params: { query, city },
    });

    return NextResponse.json({
      results: (result.results ?? []).map(mapVenue),
      count: result.count ?? 0,
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/vendor/search failed:", error);
    return NextResponse.json(
      { error: "Could not search businesses." },
      { status: 500 }
    );
  }
}
