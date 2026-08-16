"use client";

import { useCallback, useEffect, useState } from "react";
import { readAuthToken } from "./localState";
import { followProducer, followVenue, type FollowProducerResult } from "./publicApiClient";

/**
 * Optimistic follow/unfollow toggle, shared by the producer follow button
 * (profile page, event cards, event detail) and the new venue follow button.
 * Modeled on useVenueSave.ts's save/unsave toggle.
 */
export function useFollow(
  targetId: number,
  targetType: "producer" | "venue",
  source: string,
  initialFollowing = false,
  onAuthRequired?: () => void
) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followBusy, setFollowBusy] = useState(false);

  // Sync when the embedded is_following value arrives / changes.
  useEffect(() => {
    setIsFollowing(initialFollowing);
  }, [initialFollowing]);

  const toggle = useCallback(async () => {
    if (followBusy) return;
    if (!readAuthToken()) {
      onAuthRequired?.();
      return;
    }
    setFollowBusy(true);
    const optimistic = !isFollowing;
    setIsFollowing(optimistic);
    try {
      const res: FollowProducerResult =
        targetType === "venue"
          ? await followVenue(targetId, source)
          : await followProducer(targetId, source);
      setIsFollowing(res.action === "followed");
    } catch {
      setIsFollowing(!optimistic);
    } finally {
      setFollowBusy(false);
    }
  }, [followBusy, isFollowing, targetId, targetType, source, onAuthRequired]);

  return { isFollowing, followBusy, toggle };
}

export function FollowButton({
  isFollowing,
  followBusy,
  onClick,
}: {
  isFollowing: boolean;
  followBusy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={followBusy}
      className={`rounded-full border px-4 py-1.5 text-[0.72rem] font-semibold transition ${
        isFollowing ? "border-red-500 bg-red-600 text-white" : "border-gray-300 text-gray-700 dark:border-white/30 dark:text-white"
      } disabled:opacity-50`}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
