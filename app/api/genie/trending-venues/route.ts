import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/trending-venues?city_id=&offset=&limit=
 * Proxies to genie/ep_get_trending_venues_v2_dev — the homescreen venue rail's
 * "load more". The first page arrives with the homescreen response; this is
 * only for subsequent offsets.
 *
 * The endpoint also declares a `category` filter, but it 400s on the dev
 * branch, so it is deliberately never forwarded.
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
    if (offset) params.offset = offset;
    if (limit) params.limit = limit;

    const result = await xanoFetch("genie/ep_get_trending_venues_v2_dev", { params });
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load venues.");
    return NextResponse.json({ error: message }, { status });
  }
}
