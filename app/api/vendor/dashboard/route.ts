import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/vendor/dashboard?vendor_id=X
 * Proxies to genie/vendor_dashboard — returns full dashboard data.
 *
 * Also supports:
 *   GET /api/vendor/dashboard?vendor_id=X&view=analytics&period=7_days
 *   GET /api/vendor/dashboard?vendor_id=X&view=completeness
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const vendorId = request.nextUrl.searchParams.get("vendor_id") ?? "";
    const view = request.nextUrl.searchParams.get("view") ?? "dashboard";
    const period = request.nextUrl.searchParams.get("period") ?? "30_days";

    if (!vendorId) {
      return NextResponse.json(
        { error: "vendor_id is required" },
        { status: 400 }
      );
    }

    if (view === "analytics") {
      const result = await xanoFetch("genie/vendor_analytics_summary", {
        authToken,
        params: { vendor_id: vendorId, period },
      });
      return NextResponse.json(result);
    }

    if (view === "completeness") {
      const result = await xanoFetch("genie/vendor_profile_completeness", {
        authToken,
        params: { vendor_id: vendorId },
      });
      return NextResponse.json(result);
    }

    // Default: full dashboard
    const result = await xanoFetch("genie/vendor_dashboard", {
      authToken,
      params: { vendor_id: vendorId },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/vendor/dashboard failed:", error);
    return NextResponse.json(
      { error: "Could not load dashboard data." },
      { status: 500 }
    );
  }
}
