import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/producer/profile-public?producer_id=<id>
 * Proxies to: genie/ep_get_producer_profile_dev
 * Auth-required: forwards the caller's Bearer token to Xano.
 */
export async function GET(request: NextRequest) {
  try {
    const producerId = request.nextUrl.searchParams.get("producer_id");
    if (!producerId || isNaN(Number(producerId))) {
      return NextResponse.json({ error: "producer_id is required" }, { status: 400 });
    }

    const authToken = extractBearerToken(request);

    const xanoPath = "genie/ep_get_producer_profile_dev";
    console.log("[profile-public] calling Xano:", xanoPath, "producer_id:", producerId, "hasToken:", !!authToken);

    const result = await xanoFetch(xanoPath, {
      authToken,
      params: { producer_id: producerId },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not load producer profile." }, { status: 500 });
  }
}
