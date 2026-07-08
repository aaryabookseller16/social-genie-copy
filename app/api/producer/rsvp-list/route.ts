import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/producer/rsvp-list?event_id=X
 * Proxies to: genie/ep_get_rsvp_list_dev
 * Requires Bearer JWT.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const eventId = request.nextUrl.searchParams.get("event_id");

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    }

    const result = await xanoFetch("genie/ep_get_rsvp_list_dev", {
      authToken,
      params: { event_id: eventId },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not fetch RSVP list." }, { status: 500 });
  }
}
