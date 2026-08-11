import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/homescreen-influencer-offers?city_id=&offset=&limit=&shuffle_seed=
 * Proxies to genie/ep_get_homescreen_influencer_offers_dev — the homescreen
 * influencer-offers rail's "load more". The first page arrives with the
 * homescreen response; this is only for subsequent offsets.
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
    const shuffleSeed = sp.get("shuffle_seed");
    if (offset) params.offset = offset;
    if (limit) params.limit = limit;
    if (shuffleSeed) params.shuffle_seed = shuffleSeed;

    const result = await xanoFetch("genie/ep_get_homescreen_influencer_offers_dev", { params });
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load offers.");
    return NextResponse.json({ error: message }, { status });
  }
}
