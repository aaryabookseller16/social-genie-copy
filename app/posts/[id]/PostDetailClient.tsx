"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImageGallery from "@/app/components/ImageGallery";
import CommentSheet from "@/app/components/CommentSheet";
import { mediaGalleryFor } from "@/app/lib/image";
import { formatRelativeTime, initials } from "@/app/lib/postFormat";
import { usePostLike } from "@/app/lib/usePostLike";
import { type PublicPostDetailResponse } from "@/app/lib/publicApiClient";

/** Links to the author's public profile when one exists; otherwise a static row. */
function AuthorRow({ authorHref, children }: { authorHref?: string; children: ReactNode }) {
  if (authorHref) {
    return (
      <Link href={authorHref} className="flex items-center gap-3">
        {children}
      </Link>
    );
  }
  return <div className="flex items-center gap-3">{children}</div>;
}

export function PostDetailClient({
  data,
  postId,
}: {
  data: PublicPostDetailResponse;
  postId: string;
}) {
  const { post, author } = data;
  const router = useRouter();

  // globals.css sets body { overflow: hidden; height: 100dvh } for the SPA
  // shell — this is a standalone public page, so reset it (same fix
  // VenueDetailClient applies) or a post + comment thread taller than the
  // viewport can't scroll.
  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);

  const goToLogin = useCallback(() => {
    router.push(`/?screen=login&redirect=/posts/${postId}`);
  }, [router, postId]);

  const { liked, likeCount, busy: likeBusy, toggleLike } = usePostLike(
    post.id,
    post.like_count ?? 0,
    goToLogin
  );

  const handleShare = useCallback(async () => {
    const url = `https://socialbevy.com/posts/${postId}`;
    const text = post.post_text?.slice(0, 120) || "Check out this post on Social Bevy";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: author?.display_name ?? "Social Bevy", text, url });
      } catch {
        // User cancelled share — no-op
      }
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    }
  }, [postId, post.post_text, author]);

  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const media = mediaGalleryFor(post.image_url, post.image_urls, post.video_urls);
  // Venue authors link by author.venue_id (a genie_venues.id) — not post.author_id,
  // which for a venue post is the genie_vendor.id, a different row entirely.
  const authorHref =
    post.author_type === "producer" && post.author_id
      ? `/p/${post.author_id}`
      : post.author_type === "venue" && author?.venue_id
        ? `/venue/${author.venue_id}`
        : undefined;

  return (
    <main className="min-h-dvh bg-[#1a0505] pb-32">
      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#1a0505]/95 px-4 py-3 backdrop-blur-sm">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          aria-label="Back to Social Bevy"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </Link>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-4">
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-b from-red-950/60 to-black/60 shadow-xl">
          <div className="space-y-4 p-5 pb-3">
            {/* ── AUTHOR ──────────────────────────────────────────────── */}
            <AuthorRow authorHref={authorHref}>
              {author?.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={author.profile_photo_url}
                  alt={author.display_name ?? ""}
                  className="h-11 w-11 flex-none rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-red-900 text-sm font-semibold text-white">
                  {initials(author?.display_name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold text-white">
                    {author?.display_name ?? "Social Bevy"}
                  </p>
                  {author?.is_verified ? (
                    <span className="text-red-400" title="Verified">✓</span>
                  ) : null}
                </div>
                <p className="text-[0.8rem] text-white/40">
                  {formatRelativeTime(post.created_at)}
                </p>
              </div>
            </AuthorRow>

            {/* ── POST TEXT ───────────────────────────────────────────── */}
            {post.post_text ? (
              <p className="whitespace-pre-wrap text-[0.95rem] leading-6 text-white/90">
                {post.post_text}
              </p>
            ) : null}
          </div>

          {/* ── MEDIA (photos + videos, unified carousel) ──────────────── */}
          {media.length > 0 && (
            <ImageGallery
              items={media}
              alt={post.post_text ?? "Post media"}
              heightClass="h-72"
              showThumbnails={false}
            />
          )}

          {/* ── LIKE / COMMENT / SHARE ──────────────────────────────────── */}
          <div className="flex items-center gap-6 px-5 py-4">
            <button
              type="button"
              onClick={toggleLike}
              disabled={likeBusy}
              className="flex items-center gap-1.5 text-sm font-semibold text-white/85 transition disabled:pointer-events-none disabled:opacity-60"
              aria-label={liked ? "Unlike post" : "Like post"}
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-5 w-5 ${liked ? "text-red-500" : "text-white/70"}`}
                fill={liked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {likeCount > 0 ? likeCount : ""}
            </button>

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white/85"
              aria-label="View comments"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white/70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              {commentCount > 0 ? commentCount : ""}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm font-semibold text-white/85"
              aria-label="Share this post"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white/70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <CommentSheet
        postId={post.id}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialCount={commentCount}
        onCommentPosted={() => setCommentCount((c) => c + 1)}
        goToLogin={goToLogin}
      />
    </main>
  );
}
