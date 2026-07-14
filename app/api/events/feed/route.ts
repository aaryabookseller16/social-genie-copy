import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/events/feed
 * Proxies to genie/ep_get_events_feed_dev (auth'd, includes user_rsvp_status
 * and venue lat/lng per event). Signed-out visitors fall back to the public
 * genie/ep_get_events_feed_v2_dev feed so Upcoming still loads without auth.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const sp = request.nextUrl.searchParams;
    const page = sp.get("page") ?? "1";
    const perPage = sp.get("per_page") ?? "20";

    if (!authToken) {
      const result = await xanoFetch("genie/ep_get_events_feed_v2_dev", {
        params: { city_name: "Houston", page, limit: perPage },
      });
      return NextResponse.json(result);
    }

    const result = await xanoFetch("genie/ep_get_events_feed_dev", {
      params: { page, per_page: perPage, feed_type: "all" },
      authToken,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load events.");
    return NextResponse.json({ error: message }, { status });
  }
}
