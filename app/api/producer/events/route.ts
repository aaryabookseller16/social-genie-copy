import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/producer/events?page=1&per_page=20
 * Proxies to: genie/ep_get_my_events_dev
 * Returns the authenticated producer's own events (any status), newest first.
 * Requires Bearer JWT.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const page = request.nextUrl.searchParams.get("page") ?? "1";
    const perPage = request.nextUrl.searchParams.get("per_page") ?? "20";
    const actingAs = request.nextUrl.searchParams.get("acting_as");

    const params: Record<string, string> = { page, per_page: perPage };
    if (actingAs === "venue") params.acting_as = "venue";

    const result = await xanoFetch("genie/ep_get_my_events_dev", {
      authToken,
      params,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not fetch events." }, { status: 500 });
  }
}
