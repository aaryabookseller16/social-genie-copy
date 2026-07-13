"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImageGallery from "@/app/components/ImageGallery";
import { galleryFor, toImageList } from "@/app/lib/image";
import { readAuthToken, readConsumerAccount } from "@/app/lib/localState";
import { usePostLike } from "@/app/lib/usePostLike";
import {
  fetchPostComments,
  addPostComment,
  type PostComment,
  type PublicPostDetailResponse,
} from "@/app/lib/publicApiClient";

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return "";
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
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
  }, [postId, post.post_text, author?.display_name]);

  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);

  useEffect(() => {
    let cancelled = false;
    fetchPostComments(post.id)
      .then((r) => {
        if (!cancelled) setComments(r.comments ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  const handleAddComment = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = commentText.trim();
      if (!trimmed || commentBusy) return;
      if (!readAuthToken()) {
        goToLogin();
        return;
      }
      setCommentBusy(true);
      try {
        const res = await addPostComment(post.id, trimmed);
        // ep_create_comment_dev doesn't return author_name/author_avatar_url
        // (only the GET comments-list endpoint enriches those) — fill them
        // in from the logged-in user's own cached session so the comment
        // doesn't render as "Guest" / "?" until the next full refetch.
        const account = readConsumerAccount();
        const newComment: PostComment = {
          ...res.comment,
          author_name: account?.displayName || res.comment.author_name,
          author_avatar_url: account?.avatarUrl || res.comment.author_avatar_url,
        };
        setComments((prev) => [...prev, newComment]);
        setCommentCount((c) => c + 1);
        setCommentText("");
      } catch {
        if (!readAuthToken()) goToLogin();
      } finally {
        setCommentBusy(false);
      }
    },
    [commentText, commentBusy, post.id, goToLogin]
  );

  const images = galleryFor(post.image_url, post.image_urls);
  const videos = toImageList(post.video_urls);

  return (
    <main className="min-h-screen bg-white pb-32 dark:bg-transparent">
      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-black/40">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white"
          aria-label="Back to Social Bevy"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <button
          type="button"
          onClick={handleShare}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white"
          aria-label="Share this post"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
          </svg>
        </button>
      </div>

      <div className="mx-auto max-w-2xl space-y-5 px-5 pt-5">
        {/* ── AUTHOR ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          {author?.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.profile_photo_url}
              alt={author.display_name ?? ""}
              className="h-11 w-11 flex-none rounded-full object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-red-100 text-sm font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-300">
              {initials(author?.display_name)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold text-gray-900 dark:text-white">
                {author?.display_name ?? "Social Bevy"}
              </p>
              {author?.is_verified ? (
                <span className="text-red-500 dark:text-red-400" title="Verified">✓</span>
              ) : null}
            </div>
            <p className="text-[0.8rem] text-gray-400 dark:text-white/40">
              {formatRelativeTime(post.created_at)}
            </p>
          </div>
        </div>

        {/* ── POST TEXT ───────────────────────────────────────────────── */}
        {post.post_text ? (
          <p className="whitespace-pre-wrap text-[0.95rem] leading-6 text-gray-800 dark:text-white/90">
            {post.post_text}
          </p>
        ) : null}

        {/* ── IMAGES ──────────────────────────────────────────────────── */}
        <ImageGallery
          images={images}
          alt={post.post_text ?? "Post image"}
          className="overflow-hidden rounded-[18px]"
          heightClass="h-72"
        />

        {/* ── VIDEOS ──────────────────────────────────────────────────── */}
        {videos.map((url) => (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            key={url}
            src={url}
            controls
            playsInline
            className="w-full rounded-[18px] bg-black"
          />
        ))}

        {/* ── LIKE / SHARE ────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 border-y border-gray-100 py-3 dark:border-white/10">
          <button
            type="button"
            onClick={toggleLike}
            disabled={likeBusy}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-60 ${
              liked
                ? "border-red-600 bg-red-600 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:border-red-300 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-red-500/40"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {likeCount > 0 ? likeCount : "Like"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-red-300 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-red-500/40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
            </svg>
            Share
          </button>
        </div>

        {/* ── COMMENTS ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-[0.95rem] font-semibold text-gray-900 dark:text-white">
            {commentCount > 0
              ? `${commentCount} comment${commentCount === 1 ? "" : "s"}`
              : "Comments"}
          </h2>

          {commentsLoading ? (
            <p className="text-sm text-gray-400 dark:text-white/40">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-white/40">
              No comments yet. Be the first to comment.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  {c.author_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.author_avatar_url}
                      alt={c.author_name ?? ""}
                      className="h-8 w-8 flex-none rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-white/10 dark:text-white/60">
                      {initials(c.author_name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.78rem] font-semibold text-gray-900 dark:text-white">
                        {c.author_name || "Guest"}
                      </span>
                      <span className="text-[0.7rem] text-gray-400 dark:text-white/40">
                        {formatRelativeTime(c.created_at)}
                      </span>
                    </div>
                    <div className="mt-1 rounded-[14px] bg-gray-50 px-3 py-2 dark:bg-white/5">
                      <p className="text-[0.85rem] leading-5 text-gray-800 dark:text-white/85">
                        {c.comment_text}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="min-w-0 flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-red-400 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
            />
            <button
              type="submit"
              disabled={commentBusy || !commentText.trim()}
              className="flex-none rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:pointer-events-none disabled:opacity-50"
            >
              Post
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
