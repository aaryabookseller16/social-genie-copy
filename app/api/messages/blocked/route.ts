import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/messages/blocked
 * Proxies to: genie/ep_get_blocked_users_dev
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const result = await xanoFetch("genie/ep_get_blocked_users_dev", {
      authToken,
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load blocked users.");
    return NextResponse.json({ error: message }, { status });
  }
}
