import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/events/saved
 * Proxies to genie/ep_get_saved_events_dev — events with genie_event_rsvp
 * status == "saved" for the authenticated user. Signed-out visitors get an
 * empty list; the Liked tab prompts them to sign in instead of erroring.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ success: true, events: [], total: 0 });
    }

    const sp = request.nextUrl.searchParams;
    const result = await xanoFetch("genie/ep_get_saved_events_dev", {
      params: { page: sp.get("page") ?? "1", per_page: sp.get("per_page") ?? "20" },
      authToken,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load liked events.");
    return NextResponse.json({ error: message }, { status });
  }
}
