import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken } from "@/app/lib/server/xanoProxy";

type FeedPostsResponse = {
  success: boolean;
  posts: Array<{ id: number; is_followed_producer?: boolean }>;
  followed_before?: number;
  new_before?: number;
  has_more?: boolean;
};

type PostDetailResponse = {
  success: boolean;
  post: unknown;
  author: unknown;
};

type PostPair = { post: unknown; author: unknown; is_followed_producer: boolean };

async function fetchPostPair(postId: number): Promise<Omit<PostPair, "is_followed_producer"> | null> {
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
 * GET /api/genie/homescreen-post?followed_before&new_before&limit&user_id
 * Powers the homescreen's personalized Social Post feed (infinite scroll).
 *
 * Proxies to genie/ep_get_feed_posts_dev, which is public and, given a
 * user_id, composes each page from up to 3 posts by followed producers plus
 * a global backfill, interleaved newest-first. ep_get_post_dev (also public)
 * is then called once per post id to get the full author-enriched shape the
 * /posts/[id] page already uses — ep_get_feed_posts_dev only returns raw
 * rows, so the is_followed_producer flag it tags each row with has to be
 * stitched back onto the enriched pair here.
 */
export async function GET(request: NextRequest) {
  const authToken = extractBearerToken(request);
  const sp = request.nextUrl.searchParams;
  const params: Record<string, string> = {};
  for (const key of ["user_id", "followed_before", "new_before", "limit"]) {
    const value = sp.get(key);
    if (value) params[key] = value;
  }

  try {
    const feed = await xanoFetch<FeedPostsResponse>("genie/ep_get_feed_posts_dev", {
      authToken,
      params,
    });
    const items = feed.posts ?? [];
    const pairs = (
      await Promise.all(
        items.map(async (item) => {
          const pair = await fetchPostPair(item.id);
          if (!pair) return null;
          return { ...pair, is_followed_producer: item.is_followed_producer ?? false };
        })
      )
    ).filter((p): p is PostPair => p !== null);

    return NextResponse.json({
      posts: pairs,
      followed_before: feed.followed_before,
      new_before: feed.new_before,
      has_more: feed.has_more ?? false,
    });
  } catch (error) {
    console.error("[homescreen-post] feed lookup failed", error);
    return NextResponse.json({ posts: [], has_more: false });
  }
}
