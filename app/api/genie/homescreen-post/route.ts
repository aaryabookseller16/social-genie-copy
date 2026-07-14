import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken } from "@/app/lib/server/xanoProxy";
import { FEATURED_HOMESCREEN_POST_ID } from "@/app/lib/runtimeConfig";

type FeedPostsResponse = {
  success: boolean;
  posts: Array<{ id: number }>;
};

type PostDetailResponse = {
  success: boolean;
  post: unknown;
  author: unknown;
};

type PostPair = { post: unknown; author: unknown };

async function fetchPostPair(postId: number): Promise<PostPair | null> {
  try {
    const result = await xanoFetch<PostDetailResponse>("genie/ep_get_post_dev", {
      params: { post_id: String(postId) },
    });
    if (!result.success) return null;
    return { post: result.post, author: result.author };
  } catch (error) {
    console.error("[homescreen-post] post lookup failed", postId, error);
    return null;
  }
}

/**
 * GET /api/genie/homescreen-post?page=1&per_page=1
 * Powers the homescreen's paginated Social Post feed (infinite scroll).
 *
 * - Logged in (Authorization header present): page through the caller's real
 *   global post feed via genie/ep_get_feed_posts_dev (auth-gated), then
 *   re-fetch each post through the public genie/ep_get_post_dev for the full
 *   author-enriched shape the /posts/[id] page already uses.
 * - Logged out: there is no public "list posts" endpoint, so only page 1 is
 *   served — a single curated post id (FEATURED_HOMESCREEN_POST_ID) via the
 *   same public endpoint, so guests still see real content. Later pages
 *   return empty (nothing more to page through without auth).
 */
export async function GET(request: NextRequest) {
  const authToken = extractBearerToken(request);
  const page = request.nextUrl.searchParams.get("page") ?? "1";
  const perPage = request.nextUrl.searchParams.get("per_page") ?? "1";

  if (authToken) {
    try {
      const feed = await xanoFetch<FeedPostsResponse>("genie/ep_get_feed_posts_dev", {
        authToken,
        params: { page, per_page: perPage },
      });
      const ids = (feed.posts ?? []).map((p) => p.id).filter(Boolean);
      if (ids.length > 0) {
        const pairs = (await Promise.all(ids.map(fetchPostPair))).filter(
          (p): p is PostPair => p !== null
        );
        return NextResponse.json({ posts: pairs });
      }
      if (page !== "1") {
        return NextResponse.json({ posts: [] });
      }
      // Logged in but no posts in the feed at all — fall through to the
      // curated post so page 1 still shows something real.
    } catch (error) {
      console.error("[homescreen-post] feed lookup failed", error);
      if (page !== "1") {
        return NextResponse.json({ posts: [] });
      }
    }
  } else if (page !== "1") {
    return NextResponse.json({ posts: [] });
  }

  const pair = await fetchPostPair(FEATURED_HOMESCREEN_POST_ID);
  return NextResponse.json({ posts: pair ? [pair] : [] });
}
