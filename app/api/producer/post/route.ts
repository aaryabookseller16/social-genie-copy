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
 * Body: { post_text, image_url?, image_urls? }
 * Proxies to: genie/ep_create_post_dev
 * Requires Bearer JWT.
 *
 * `image_urls` is an ordered array of hosted Cloudinary URLs (index 0 is the
 * primary), produced client-side by /api/upload/image. Xano caps it at 5.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const postText = String(body.post_text ?? "").trim();
    if (!postText) {
      return NextResponse.json({ error: "post_text is required" }, { status: 400 });
    }

    const imageUrls = Array.isArray(body.image_urls)
      ? body.image_urls.filter(
          (url): url is string => typeof url === "string" && url.trim().length > 0
        )
      : undefined;

    const result = await xanoFetch("genie/ep_create_post_dev", {
      method: "POST",
      authToken,
      body: {
        post_text: postText,
        image_url: String(body.image_url ?? "").trim() || undefined,
        image_urls: imageUrls,
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

/**
 * PATCH /api/producer/post
 * Body: { post_id, post_text?, image_url?, image_urls? }
 * Proxies to: genie/ep_update_post_dev — owner-only, patches what it receives.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const postId = Number(body.post_id);
    if (!postId) {
      return NextResponse.json({ error: "post_id is required" }, { status: 400 });
    }

    const payload: Record<string, unknown> = { post_id: postId };
    if (body.post_text !== undefined) payload.post_text = String(body.post_text).trim();
    if (body.image_url !== undefined) payload.image_url = String(body.image_url).trim();

    // Xano can't tell an empty array from an absent one, so removing every image
    // needs the explicit flag rather than `image_urls: []`.
    if (Array.isArray(body.image_urls)) {
      const urls = body.image_urls.filter(
        (url): url is string => typeof url === "string" && url.trim().length > 0
      );
      if (urls.length > 0) payload.image_urls = urls;
      else payload.clear_images = true;
    }

    const result = await xanoFetch("genie/ep_update_post_dev", {
      method: "POST",
      authToken,
      body: payload,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not update post." }, { status: 500 });
  }
}

/**
 * DELETE /api/producer/post?post_id=123
 * Proxies to: genie/ep_delete_post_dev — owner-only soft delete (is_deleted = true).
 */
export async function DELETE(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const postId = Number(request.nextUrl.searchParams.get("post_id"));
    if (!postId) {
      return NextResponse.json({ error: "post_id is required" }, { status: 400 });
    }

    const result = await xanoFetch("genie/ep_delete_post_dev", {
      method: "POST",
      authToken,
      body: { post_id: postId },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not delete post." }, { status: 500 });
  }
}
