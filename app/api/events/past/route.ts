import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/events/past
 * Proxies to genie/ep_get_past_events_dev — requires auth (reads
 * $auth.id for user_rsvp_status / user_has_rated addons).
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const result = await xanoFetch("genie/ep_get_past_events_dev", {
      params: { page: sp.get("page") ?? "1", per_page: sp.get("per_page") ?? "20" },
      authToken,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load past events.");
    return NextResponse.json({ error: message }, { status });
  }
}
