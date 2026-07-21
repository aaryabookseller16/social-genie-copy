import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/nearby-venues?lat=&lng=&radius_m=&limit=&offset=
 * Proxies to genie/ep_get_nearby_venues_dev — venues near a coordinate, sorted
 * nearest-first. Public on Xano's side; no token is forwarded.
 *
 * `lat`/`lng` are the only params Xano rejects (400). `radius_m`, `limit` and
 * `offset` are silently clamped server-side, so they're passed straight through
 * and the caller reads the echoed values back off the response.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const lat = sp.get("lat");
    const lng = sp.get("lng");
    if (!lat || Number.isNaN(Number(lat))) {
      return NextResponse.json({ error: "lat is required" }, { status: 400 });
    }
    if (!lng || Number.isNaN(Number(lng))) {
      return NextResponse.json({ error: "lng is required" }, { status: 400 });
    }

    const params: Record<string, string> = { lat, lng };
    for (const key of ["radius_m", "limit", "offset"]) {
      const value = sp.get(key);
      if (value) params[key] = value;
    }

    const result = await xanoFetch("genie/ep_get_nearby_venues_dev", { params });
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load nearby venues.");
    return NextResponse.json({ error: message }, { status });
  }
}
