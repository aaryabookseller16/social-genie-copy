import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/producer/posts-public?producer_id=<id>&page=1&per_page=20
 * Proxies to: genie/ep_get_feed_posts_dev with author_id set — the feed-list
 * endpoint already supports filtering by author. Used on the public producer
 * profile page (/p/[id]), which already requires the visitor to be logged in.
 */
export async function GET(request: NextRequest) {
  try {
    const producerId = request.nextUrl.searchParams.get("producer_id");
    if (!producerId || isNaN(Number(producerId))) {
      return NextResponse.json({ error: "producer_id is required" }, { status: 400 });
    }

    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const page = request.nextUrl.searchParams.get("page") ?? "1";
    const perPage = request.nextUrl.searchParams.get("per_page") ?? "20";

    const result = await xanoFetch("genie/ep_get_feed_posts_dev", {
      authToken,
      params: { author_id: producerId, page, per_page: perPage },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not load posts." }, { status: 500 });
  }
}
