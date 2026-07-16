import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/post/{id}/like
 * Proxies to: genie/ep_toggle_post_like_dev
 * Requires Bearer JWT — anonymous requests are rejected here rather than
 * left to Xano, so the client gets a clean 401 to react to.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const postId = Number(id);
    if (!Number.isFinite(postId) || postId <= 0) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const result = await xanoFetch("genie/ep_toggle_post_like_dev", {
      method: "POST",
      authToken,
      body: { post_id: postId },
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not update like.");
    return NextResponse.json({ error: message }, { status });
  }
}
