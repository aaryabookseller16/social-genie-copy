import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/producer/suggested
 * Proxies to: genie/ep_get_suggested_follows_dev
 * Auth-required: suggestions exclude producers the caller already follows.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const params: Record<string, string> = {};
    const limit = sp.get("limit");
    const shuffleSeed = sp.get("shuffle_seed");
    if (limit) params.limit = limit;
    if (shuffleSeed) params.shuffle_seed = shuffleSeed;

    const result = await xanoFetch("genie/ep_get_suggested_follows_dev", { params, authToken });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not load suggested producers." }, { status: 500 });
  }
}
