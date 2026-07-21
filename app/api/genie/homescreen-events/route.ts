import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/homescreen-events?city_id=&offset=&limit=&user_id=
 * Proxies to genie/ep_get_homescreen_events_dev — the homescreen event rail's
 * "load more". Returns the next page of the same live-first ordering the
 * homescreen's first page came from, so pages are appended, never re-sorted.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const cityId = sp.get("city_id");
    if (!cityId || Number.isNaN(Number(cityId))) {
      return NextResponse.json({ error: "city_id is required" }, { status: 400 });
    }

    const params: Record<string, string> = { city_id: cityId };
    const offset = sp.get("offset");
    const limit = sp.get("limit");
    const userId = sp.get("user_id");
    if (offset) params.offset = offset;
    if (limit) params.limit = limit;
    if (userId) params.user_id = userId;

    const result = await xanoFetch("genie/ep_get_homescreen_events_dev", { params });
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load events.");
    return NextResponse.json({ error: message }, { status });
  }
}
