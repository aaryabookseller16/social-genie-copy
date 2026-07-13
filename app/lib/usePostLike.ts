"use client";

import { useCallback, useEffect, useState } from "react";
import { readAuthToken } from "./localState";
import { toggleLikePost, fetchMyPostLikeStatus } from "./publicApiClient";

/**
 * Optimistic like/unlike for a post, modeled on useEventRsvp.ts.
 *
 * The post detail page is server-rendered with no auth context, so `liked`
 * is unknown until this fires a second, authenticated fetch on mount (same
 * pattern EventDetailClient uses for RSVP status).
 */
export function usePostLike(
  postId: number,
  initialLikeCount: number,
  onAuthRequired?: () => void
) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount || 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!readAuthToken()) return;
    let cancelled = false;
    fetchMyPostLikeStatus(postId)
      .then((r) => {
        if (!cancelled) setLiked(r.liked);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const toggleLike = useCallback(async () => {
    if (busy) return;
    if (!readAuthToken()) {
      onAuthRequired?.();
      return;
    }

    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);
    setBusy(true);
    try {
      await toggleLikePost(postId);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      if (!readAuthToken()) onAuthRequired?.();
    } finally {
      setBusy(false);
    }
  }, [busy, liked, likeCount, postId, onAuthRequired]);

  return { liked, likeCount, busy, toggleLike };
}
