import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/post/{id}/like-status
 * Proxies to: genie/ep_get_my_post_like_status_dev
 * Requires Bearer JWT — this endpoint only ever answers "did *I* like this".
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const result = await xanoFetch("genie/ep_get_my_post_like_status_dev", {
      authToken,
      params: { post_id: id },
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load like status.");
    return NextResponse.json({ error: message }, { status });
  }
}
