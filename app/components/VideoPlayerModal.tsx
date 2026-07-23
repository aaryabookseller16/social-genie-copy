"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen video player overlay. object-contain (not cover) so a portrait/
 * vertical (Instagram-style) video shows its full frame instead of being
 * cropped — same reasoning as ImageGallery's video rendering.
 */
export type VideoPlayerModalProps = {
  url: string;
  posterUrl?: string;
  title?: string;
  onClose: () => void;
};

export default function VideoPlayerModal({ url, posterUrl, title, onClose }: VideoPlayerModalProps) {
  const [failed, setFailed] = useState(false);

  /* Escape closes, and the page behind must not scroll while the overlay is up. */
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
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Video"}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close video"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>

      {failed ? (
        <div
          className="flex flex-col items-center gap-3 px-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[0.85rem] text-white/70">This video could not be played.</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/25 px-5 py-2 text-[0.78rem] font-semibold text-white/80"
          >
            Close
          </button>
        </div>
      ) : (
        <video
          src={url}
          poster={posterUrl}
          controls
          autoPlay
          playsInline
          onError={() => setFailed(true)}
          className="max-h-full max-w-full rounded-xl bg-black object-contain"
          style={{ maxHeight: "85vh" }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {title && !failed && (
        <span className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-sm font-medium text-white/80">
          {title}
        </span>
      )}
    </div>
  );
}
