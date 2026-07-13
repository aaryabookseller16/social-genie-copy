import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/events/search?query=X
 * Proxies to genie/ep_search_events_dev?query=X
 * Public — no auth required. Returns active events matching the query,
 * for the influencer's event-offer picker.
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
    if (query.length < 2) {
      return NextResponse.json({ results: [], count: 0 });
    }

    const result = await xanoFetch<{
      results: Array<{
        id: number;
        title: string;
        event_date?: string;
        venue_name?: string | null;
        city?: string;
      }>;
      count: number;
    }>("genie/ep_search_events_dev", {
      params: { query },
    });

    return NextResponse.json({
      results: result.results ?? [],
      count: result.count ?? 0,
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/events/search failed:", error);
    return NextResponse.json(
      { error: "Could not search events." },
      { status: 500 }
    );
  }
}
