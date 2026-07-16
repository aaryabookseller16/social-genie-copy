import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/post/{id}/comments?page=1&per_page=20
 * Proxies to: genie/ep_get_post_comments_dev — public, no auth required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const page = request.nextUrl.searchParams.get("page") ?? "1";
    const perPage = request.nextUrl.searchParams.get("per_page") ?? "20";

    const result = await xanoFetch("genie/ep_get_post_comments_dev", {
      params: { post_id: id, page, per_page: perPage },
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load comments.");
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/post/{id}/comments
 * Body: { comment_text, parent_comment_id? }
 * Proxies to: genie/ep_create_comment_dev with content_type: "post".
 * Requires Bearer JWT.
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
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const commentText = String(body.comment_text ?? "").trim();
    if (!commentText) {
      return NextResponse.json({ error: "comment_text is required" }, { status: 400 });
    }

    const parentCommentId =
      body.parent_comment_id !== undefined && body.parent_comment_id !== null
        ? Number(body.parent_comment_id)
        : undefined;

    const result = await xanoFetch("genie/ep_create_comment_dev", {
      method: "POST",
      authToken,
      body: {
        content_type: "post",
        content_id: Number(id),
        comment_text: commentText,
        parent_comment_id: parentCommentId,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not post comment.");
    return NextResponse.json({ error: message }, { status });
  }
}
