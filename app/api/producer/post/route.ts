import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/producer/post?page=1&per_page=20
 * Proxies to: genie/ep_get_my_posts_dev
 * Returns the authenticated producer's own posts, newest first.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const page = request.nextUrl.searchParams.get("page") ?? "1";
    const perPage = request.nextUrl.searchParams.get("per_page") ?? "20";

    const result = await xanoFetch("genie/ep_get_my_posts_dev", {
      authToken,
      params: { page, per_page: perPage },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not fetch posts." }, { status: 500 });
  }
}

/**
 * POST /api/producer/post
 * Body: { post_text, image_url? }
 * Proxies to: genie/ep_create_post_dev
 * Requires Bearer JWT.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const postText = String(body.post_text ?? "").trim();
    if (!postText) {
      return NextResponse.json({ error: "post_text is required" }, { status: 400 });
    }

    const result = await xanoFetch("genie/ep_create_post_dev", {
      method: "POST",
      authToken,
      body: {
        post_text: postText,
        image_url: String(body.image_url ?? "").trim() || undefined,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not create post." }, { status: 500 });
  }
}
