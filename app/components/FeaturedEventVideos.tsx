"use client";

import { useState } from "react";
import VideoPlayerModal from "./VideoPlayerModal";

/**
 * A horizontal row of an event's own videos, styled to match the homescreen's
 * "Featured" video cards (poster + play badge). Tapping a card opens a
 * full-screen player instead of playing inline.
 */
export type FeaturedEventVideosProps = {
  videos: { url: string; thumbnail_url: string }[] | null | undefined;
  eventTitle?: string;
  className?: string;
  /** Override for light-themed pages — defaults to white, for the app's dark-themed screens. */
  headingClassName?: string;
};

export default function FeaturedEventVideos({
  videos,
  eventTitle,
  className = "",
  headingClassName = "text-white",
}: FeaturedEventVideosProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!Array.isArray(videos) || videos.length === 0) return null;

  return (
    <div className={className}>
      <h2 className={`mb-3 font-[family:var(--font-display)] text-[1.4rem] ${headingClassName}`}>Videos</h2>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((v, i) => (
          <button
            key={v.url}
            type="button"
            onClick={() => setActiveIndex(i)}
            aria-label={`Play video ${i + 1}`}
            className={`relative ${i === 0 ? "w-52" : "w-44"} h-64 flex-none overflow-hidden rounded-[16px] bg-zinc-900`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="pointer-events-none absolute inset-0 flex items-end justify-start p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        ))}
      </div>

      {activeIndex !== null && (
        <VideoPlayerModal
          url={videos[activeIndex].url}
          posterUrl={videos[activeIndex].thumbnail_url}
          title={eventTitle}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </div>
  );
}
