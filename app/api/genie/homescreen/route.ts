import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/homescreen
 * Proxies to genie/ep_get_homescreen_dev (#591)
 *
 * Required: city_id (default 1 = Houston), city_name (default "Houston")
 * Optional: user_id, lat, lng
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const cityId = sp.get("city_id") ?? "1";
    const cityName = sp.get("city_name") ?? "Houston";
    const userId = sp.get("user_id") ?? "";
    const lat = sp.get("lat") ?? "";
    const lng = sp.get("lng") ?? "";

    const params: Record<string, string> = {
      city_id: cityId,
      city_name: cityName,
    };
    if (userId) params.user_id = userId;
    if (lat) params.lat = lat;
    if (lng) params.lng = lng;

    const result = await xanoFetch("genie/ep_get_homescreen_dev", { params });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Could not load homescreen." },
      { status: 500 }
    );
  }
}
