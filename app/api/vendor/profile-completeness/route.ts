import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/vendor/profile-completeness?vendor_id=X
 * Profile score and missing fields — available on both Basic and Pro dashboards.
 * Proxies to genie/vendor_profile_completeness (Genie base URL api:pgMKWi2e)
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

    const result = await xanoFetch("genie/vendor_profile_completeness", {
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
    console.error("GET /api/vendor/profile-completeness failed:", error);
    return NextResponse.json(
      { error: "Could not load profile completeness." },
      { status: 500 }
    );
  }
}
