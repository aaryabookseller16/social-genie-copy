import { NextRequest, NextResponse } from "next/server";
import {
  extractBearerToken,
  toClientError,
  xanoFetch,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/vendor/influencer-offers?status=active|pending|rejected
 * Returns influencer offers (all statuses, or filtered) for the venues the
 * calling owner has claimed. Owned venues are resolved server-side from the JWT.
 * Proxies to: genie/ep_get_venue_pending_offers_dev (returns all statuses)
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

    const status = request.nextUrl.searchParams.get("status")?.trim();
    const params =
      status === "active" || status === "pending" || status === "rejected"
        ? { status }
        : undefined;

    const result = await xanoFetch("genie/ep_get_venue_pending_offers_dev", {
      authToken,
      params,
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(
      error,
      "Could not load influencer offers."
    );
    return NextResponse.json({ error: message }, { status });
  }
}
