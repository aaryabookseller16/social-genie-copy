"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatRelativeTime, initials } from "@/app/lib/postFormat";
import { readAuthToken } from "@/app/lib/localState";
import {
  fetchPostComments,
  addPostComment,
  type PostComment,
} from "@/app/lib/publicApiClient";
import ImageLightbox from "@/app/components/ImageLightbox";

export type CommentSheetProps = {
  postId: number;
  isOpen: boolean;
  onClose: () => void;
  initialCount: number;
  onCommentPosted?: () => void;
  goToLogin: () => void;
};

/**
 * Bottom-sheet comment thread. Comments are only fetched the first time the
 * sheet opens (not on page load) and cached afterwards — reopening doesn't
 * refetch. Flat list: no client-side reply-thread grouping (backend returns
 * an unthreaded list; see plan for why).
 */
export default function CommentSheet({
  postId,
  isOpen,
  onClose,
  initialCount,
  onCommentPosted,
  goToLogin,
}: CommentSheetProps) {
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [postError, setPostError] = useState(false);
  const [replyingTo, setReplyingTo] = useState<PostComment | null>(null);

  // Static display only — genie/ep_like_comment_dev 404s live ("Unable to
  // locate request", the branch-skew trap CLAUDE.md warns about: present in
  // the v1.5-dev source, not deployed). No working toggle endpoint, so the
  // heart shows like_count but isn't interactive.
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [lightboxAvatar, setLightboxAvatar] = useState<{ src: string; alt: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const loadComments = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchPostComments(postId)
      .then((r) => {
        if (cancelled) return;
        const list = r.comments ?? [];
        setComments(list);
        setLikeCounts(
          Object.fromEntries(list.map((c) => [c.id, c.like_count ?? 0]))
        );
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  // Lazy load: fetch only the first time the sheet opens. Deliberately not
  // gated on `loading` — dev-mode Strict Mode mounts effects twice
  // (run -> cleanup -> run), and gating re-entry on a `loading` state that
  // the cancelled first fetch's `finally` correctly skips resetting would
  // deadlock the sheet on "Loading comments..." forever. `comments !== null`
  // is sufficient to stop re-fetching once a fetch has actually succeeded.
  useEffect(() => {
    if (!isOpen || comments !== null) return;
    return loadComments();
  }, [isOpen, comments, loadComments]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const handleReply = useCallback((comment: PostComment) => {
    setReplyingTo(comment);
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = commentText.trim();
      if (!trimmed || commentBusy) return;
      if (!readAuthToken()) {
        goToLogin();
        return;
      }
      setCommentBusy(true);
      setPostError(false);
      try {
        const res = await addPostComment(postId, trimmed, replyingTo?.id);
        setComments((prev) => [...(prev ?? []), res.comment]);
        setLikeCounts((prev) => ({ ...prev, [res.comment.id]: res.comment.like_count ?? 0 }));
        setCommentText("");
        setReplyingTo(null);
        onCommentPosted?.();
      } catch {
        if (!readAuthToken()) goToLogin();
        else setPostError(true);
      } finally {
        setCommentBusy(false);
      }
    },
    [commentText, commentBusy, postId, replyingTo, goToLogin, onCommentPosted]
  );

  if (!isOpen) return null;

  const count = comments?.length ?? initialCount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Comments"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-3xl bg-[#1a0505] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-none flex-col items-center gap-3 pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-white/20" />
          <h2 className="text-[0.95rem] font-semibold text-white">
            {count > 0 ? `${count} Comment${count === 1 ? "" : "s"}` : "Comments"}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {loading ? (
            <p className="py-6 text-center text-sm text-white/40">Loading comments…</p>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="text-sm text-white/50">Couldn&apos;t load comments.</p>
              <button
                type="button"
                onClick={loadComments}
                className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white/80"
              >
                Retry
              </button>
            </div>
          ) : comments && comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">
              No comments yet. Be the first to comment.
            </p>
          ) : (
            <ul className="space-y-4 py-2">
              {comments?.map((c) => {
                const likeCount = likeCounts[c.id] ?? c.like_count ?? 0;
                return (
                  <li key={c.id} className="flex gap-2.5">
                    {c.author_avatar_url ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxAvatar({ src: c.author_avatar_url!, alt: c.author_name ?? "" })
                        }
                        aria-label="View profile photo"
                        className="h-9 w-9 flex-none cursor-pointer overflow-hidden rounded-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.author_avatar_url}
                          alt={c.author_name ?? ""}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-red-900 text-xs font-semibold text-white">
                        {initials(c.author_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[0.82rem] font-semibold text-white">
                          {c.author_name || "Guest"}
                        </span>
                        <span className="text-[0.72rem] text-white/40">
                          {formatRelativeTime(c.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[0.85rem] leading-5 text-white/85">
                        {c.comment_text}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleReply(c)}
                        className="mt-1 text-[0.75rem] font-medium text-white/40"
                      >
                        Reply
                      </button>
                    </div>
                    <div className="flex flex-none flex-col items-center gap-0.5 pt-0.5">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 text-white/40"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      {likeCount > 0 && (
                        <span className="text-[0.68rem] text-white/40">{likeCount}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex-none border-t border-white/10 px-4 py-3">
          {replyingTo && (
            <div className="mb-2 flex items-center justify-between text-[0.75rem] text-white/50">
              <span>Replying to {replyingTo.author_name || "Guest"}</span>
              <button type="button" onClick={() => setReplyingTo(null)} className="text-white/70">
                Cancel
              </button>
            </div>
          )}
          {postError && (
            <p className="mb-2 text-[0.75rem] text-red-400">
              Couldn&apos;t post comment, try again.
            </p>
          )}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Reply ..."
              className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-red-400"
            />
            <button
              type="submit"
              disabled={commentBusy || !commentText.trim()}
              aria-label="Post comment"
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-red-600 text-white transition disabled:pointer-events-none disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </form>
        </div>
      </div>
      {lightboxAvatar ? (
        <ImageLightbox
          src={lightboxAvatar.src}
          alt={lightboxAvatar.alt}
          onClose={() => setLightboxAvatar(null)}
        />
      ) : null}
    </div>
  );
}
