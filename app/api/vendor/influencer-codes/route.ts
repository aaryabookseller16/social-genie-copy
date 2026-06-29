import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/vendor/influencer-codes?vendor_id=X
 * Proxies to genie/ep_get_venue_influencer_codes_dev
 * Returns empty array gracefully if the endpoint doesn't exist yet in Xano.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const vendorId = request.nextUrl.searchParams.get("vendor_id") ?? "";

    if (!vendorId) {
      return NextResponse.json(
        { error: "vendor_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch(
      "genie/ep_get_venue_influencer_codes_dev",
      {
        authToken,
        params: { vendor_id: vendorId },
      }
    );

    return NextResponse.json(result ?? { codes: [] });
  } catch (error) {
    if (error instanceof XanoError) {
      if (error.status === 404) {
        return NextResponse.json({ codes: [] });
      }
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/vendor/influencer-codes failed:", error);
    return NextResponse.json({ codes: [] });
  }
}
