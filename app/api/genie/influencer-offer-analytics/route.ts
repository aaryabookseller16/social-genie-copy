import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/influencer-offer-analytics?influencer_id=<id>
 * influencer_id is optional — defaults to the calling influencer.
 * Proxies to: genie/influencer/offer-analytics
 *
 * Returns per-offer aggregate counts (total_redemptions, new_user_count,
 * vibbee_conversions). There is no per-redemption list.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);

    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const influencerId = request.nextUrl.searchParams.get("influencer_id");
    const params: Record<string, string> = {};
    if (influencerId) params.influencer_id = influencerId;

    const result = await xanoFetch("genie/influencer/offer-analytics", {
      authToken,
      params,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Could not load offer analytics." },
      { status: 500 }
    );
  }
}
