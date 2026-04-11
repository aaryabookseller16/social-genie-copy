import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/vendor/dashboard?vendor_id=X
 * Proxies to genie/vendor_dashboard_v1.
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

    const result = await xanoFetch("genie/vendor_dashboard_v1", {
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
