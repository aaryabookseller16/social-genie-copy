import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/vendor/profile
 * Returns the authenticated user's vendor record, or { vendor: null } if none.
 * Proxies to: genie/ep_get_my_vendor_profile_dev
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);

    const result = await xanoFetch("genie/ep_get_my_vendor_profile_dev", {
      authToken,
    });

    const raw = result as { vendor: Record<string, unknown> | null };
    return NextResponse.json({ vendor: raw.vendor ?? null });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ vendor: null });
    }
    return NextResponse.json({ error: "Could not fetch vendor profile." }, { status: 500 });
  }
}
