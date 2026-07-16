import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/influencer-offers?handle=<handle>
 * Returns active offers for an influencer by handle (public endpoint).
 * Proxies to: genie/ep_get_influencer_offers_dev
 */
export async function GET(request: NextRequest) {
  try {
    const handle = request.nextUrl.searchParams.get("handle") ?? "";

    if (!handle) {
      return NextResponse.json(
        { error: "handle is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/ep_get_influencer_offers_dev", {
      params: { handle },
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
      { error: "Could not load influencer offers." },
      { status: 500 }
    );
  }
}
