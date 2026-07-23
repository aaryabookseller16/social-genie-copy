"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import VideoPlayerModal from "@/app/components/VideoPlayerModal";
import { FEATURED_HOMESCREEN_VIDEOS, type FeaturedVideo } from "@/app/lib/runtimeConfig";
import {
  cloudinaryVideoVariant,
  deriveVideoThumbnail,
  VIDEO_VARIANT_PLAYBACK,
  VIDEO_VARIANT_PREVIEW,
} from "@/app/lib/videoUpload";

/**
 * Homescreen "Featured" rail.
 *
 * Exactly one card plays at a time: whichever is most in view. A single
 * IntersectionObserver rooted at the viewport covers both axes, because the
 * intersection rect is clipped by ancestor scroll containers — so scrolling the
 * rail sideways hands playback to the next card, and scrolling the page past
 * the section stops playback instead of leaving a video running off-screen.
 *
 * Inline playback is muted and looping, the only form browsers will autoplay
 * without a user gesture. Tapping a card opens VideoPlayerModal for sound and
 * real controls.
 *
 * Only the active card carries preload="auto"; the rest stay at "none" behind
 * their poster. Letting all of them preload downloads every source at once —
 * measured at ~17MB for the current three — which starves the one card the
 * user is actually looking at, so none of them ever reach a playable state.
 */

/** A card must be this visible before it takes over playback. */
const MIN_VISIBLE_RATIO = 0.6;

const OBSERVER_THRESHOLDS = [0, 0.25, 0.5, MIN_VISIBLE_RATIO, 0.85, 1];

export type FeaturedVideoRailProps = {
  videos?: FeaturedVideo[];
  className?: string;
};

export default function FeaturedVideoRail({
  videos = FEATURED_HOMESCREEN_VIDEOS,
  className = "",
}: FeaturedVideoRailProps) {
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const ratiosRef = useRef<number[]>([]);

  // Starts at 0 so the first card plays as soon as it mounts, before the
  // observer has had a chance to report anything.
  const [activeIndex, setActiveIndex] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  const playable = useMemo(
    () => videos.filter((video) => !failedIds.includes(video.id)),
    [videos, failedIds]
  );

  const markFailed = useCallback((id: string) => {
    setFailedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  /* Users who ask for reduced motion get posters and a tap-to-play badge. */
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  /* Hand playback to the most-visible card. */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const nodes = cardRefs.current.slice(0, videos.length).filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isInteger(index)) ratiosRef.current[index] = entry.intersectionRatio;
        }

        let bestIndex = -1;
        let bestRatio = 0;
        ratiosRef.current.forEach((ratio, index) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIndex = index;
          }
        });

        // Below the threshold nothing is meaningfully on screen — pause all.
        setActiveIndex(bestRatio >= MIN_VISIBLE_RATIO ? bestIndex : -1);
      },
      { threshold: OBSERVER_THRESHOLDS }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [videos.length]);

  /* Apply the decision above to the actual media elements. */
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;

      const source = videos[index];
      const shouldPlay =
        index === activeIndex &&
        openIndex === null &&
        !reducedMotion &&
        !!source &&
        !failedIds.includes(source.id);

      if (!shouldPlay) {
        video.pause();
        return;
      }

      const playback = video.play();
      if (playback) {
        playback.catch(() => {
          // Autoplay refused (data saver, low power mode) or interrupted by a
          // pause() that raced this call. The poster and play badge stay up —
          // tapping the card still opens the full player, so this is not an
          // error worth surfacing.
        });
      }
    });
  }, [activeIndex, openIndex, reducedMotion, failedIds, videos]);

  const openVideo = useCallback((index: number) => setOpenIndex(index), []);
  const closeVideo = useCallback(() => setOpenIndex(null), []);

  // Nothing to show, or every source is broken — drop the section entirely
  // rather than render a rail of dead tiles.
  if (!playable.length) return null;

  const active = openIndex !== null ? videos[openIndex] : null;

  return (
    <section className={className} aria-label="Featured videos">
      <h2 className="mb-3 font-[family:var(--font-display)] text-[1.4rem] text-gray-900 dark:text-white">
        Featured
      </h2>

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((video, index) => {
          const hasFailed = failedIds.includes(video.id);
          const poster = video.posterUrl ?? safeThumbnail(video.url);
          // Width is a share of the rail, not a fixed size, so exactly one card
          // can clear MIN_VISIBLE_RATIO at a time. Fixed-width cards let two sit
          // fully on screen at once, and the ratio tie then always resolves to
          // the earlier one — which left the last video unable to ever become
          // active. A percentage keeps that geometry true at any rail width.
          const cardClass =
            "relative aspect-[4/5] w-[62%] min-w-[150px] max-h-[400px] flex-none snap-start overflow-hidden rounded-[16px] bg-zinc-900";

          if (hasFailed) {
            return (
              <div
                key={video.id}
                className={`${cardClass} flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900`}
              >
                <span className="px-4 text-center text-[0.7rem] font-medium text-white/45">
                  Video unavailable
                </span>
              </div>
            );
          }

          return (
            <button
              key={video.id}
              type="button"
              data-index={index}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              onClick={() => openVideo(index)}
              aria-label={`Play ${video.title}`}
              className={`${cardClass} text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
            >
              <video
                ref={(node) => {
                  videoRefs.current[index] = node;
                }}
                src={cloudinaryVideoVariant(video.url, VIDEO_VARIANT_PREVIEW)}
                poster={poster}
                muted
                loop
                playsInline
                disablePictureInPicture
                preload={index === activeIndex ? "auto" : "none"}
                onError={() => markFailed(video.id)}
                className="h-full w-full object-cover"
              />

              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

              {/* The badge marks the card as tappable and covers the case where
                  autoplay was refused, so a paused card never looks broken. */}
              <span className="pointer-events-none absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="ml-0.5 h-3.5 w-3.5"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>

              <span className="pointer-events-none absolute inset-x-2.5 bottom-2.5 line-clamp-2 text-[0.72rem] font-semibold leading-4 text-white">
                {video.title}
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <VideoPlayerModal
          url={cloudinaryVideoVariant(active.url, VIDEO_VARIANT_PLAYBACK)}
          posterUrl={active.posterUrl ?? safeThumbnail(active.url)}
          title={active.title}
          onClose={closeVideo}
        />
      )}
    </section>
  );
}

/**
 * deriveVideoThumbnail assumes a Cloudinary delivery URL. A non-Cloudinary URL
 * would come back mangled, so fall back to no poster rather than a 404 image.
 */
function safeThumbnail(url: string): string | undefined {
  if (!url.includes("/upload/")) return undefined;
  try {
    return deriveVideoThumbnail(url);
  } catch {
    return undefined;
  }
}
