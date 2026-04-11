import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/vendor/analytics?vendor_id=X&period=30_days
 * Period-based analytics — Pro tier only.
 * Proxies to genie/vendor_analytics_summary (Genie base URL api:pgMKWi2e)
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const vendorId = request.nextUrl.searchParams.get("vendor_id") ?? "";
    const period = request.nextUrl.searchParams.get("period") ?? "30_days";

    if (!vendorId) {
      return NextResponse.json(
        { error: "vendor_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/vendor_analytics_summary", {
      authToken,
      params: { vendor_id: vendorId, period },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/vendor/analytics failed:", error);
    return NextResponse.json(
      { error: "Could not load analytics data." },
      { status: 500 }
    );
  }
}
