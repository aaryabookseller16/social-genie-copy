import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/user/basic-profile?user_id=<id>
 * Proxies to: genie/ep_get_user_basic_dev
 * Returns just { display_name, avatar_url } for a genie_user — used to show
 * a real customer name in the producer's message inbox instead of a
 * generic "Customer" placeholder.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = request.nextUrl.searchParams.get("user_id");
    if (!userId || isNaN(Number(userId))) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const result = await xanoFetch("genie/ep_get_user_basic_dev", {
      authToken,
      params: { user_id: userId },
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load user profile.");
    return NextResponse.json({ error: message }, { status });
  }
}
