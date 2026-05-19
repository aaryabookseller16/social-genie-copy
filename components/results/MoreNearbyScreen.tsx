"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HamburgerMenu from "@/components/nav/HamburgerMenu";
import { pickVenueImage } from "@/app/lib/image";

type ResultVenue = {
  id: string | number;
  venue_name: string;
  area_neighborhood?: string | null;
  vibe_notes?: string | null;
  image?: string | null;
  tags?: string[];
};

const STORAGE_MORE_KEY = "genie_last_more_v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isRemoteUrl(src: string) {
  return /^https?:\/\//i.test(src);
}

function VenueRow({ venue, onClick }: { venue: ResultVenue; onClick?: () => void }) {
  const chips =
    venue.tags && venue.tags.length
      ? venue.tags.slice(0, 3)
      : (venue.vibe_notes || "")
          .split(/[·,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3);

  const src = pickVenueImage(venue);
  const remote = isRemoteUrl(src);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-3xl border border-white/50 dark:border-white/10 bg-white/70 dark:bg-black/25 backdrop-blur shadow-sm hover:shadow-md transition overflow-hidden"
    >
      <div className="flex">
        <div className="relative w-28 h-28 flex-shrink-0 bg-black/5">
          {remote ? (
            <img
              src={src}
              alt={venue.venue_name}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Image src={src} alt={venue.venue_name} fill className="object-cover" />
          )}
        </div>

        <div className="flex-1 px-4 py-3">
          <div className="text-[16px] font-semibold text-zinc-900 dark:text-zinc-100">
            {venue.venue_name}
          </div>

          <div className="mt-1 text-[13px] text-zinc-600 dark:text-zinc-300">
            {venue.area_neighborhood || "—"}
          </div>

          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {chips.map((t, idx) => (
                <span
                  key={`${t}-${idx}`}
                  className="text-[11px] px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-zinc-700 dark:text-zinc-200"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function MoreNearbyScreen() {
  const router = useRouter();
  const [list, setList] = useState<ResultVenue[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_MORE_KEY);
    const parsed = safeParse<ResultVenue[]>(raw, []);
    setList(Array.isArray(parsed) ? parsed : []);
  }, []);

  return (
    <main className="min-h-screen relative overflow-hidden bg-zinc-50 dark:bg-black">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] h-[680px] rounded-full blur-3xl bg-red-500/20 dark:bg-red-600/25" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-6 pb-10">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="h-10 w-10 rounded-full bg-white/70 dark:bg-white/10 border border-zinc-200/60 dark:border-white/10 backdrop-blur shadow-sm flex items-center justify-center"
            >
              ←
            </button>

            <div className="text-[18px] font-semibold text-zinc-900 dark:text-zinc-100">
              More nearby
            </div>
          </div>

          <HamburgerMenu />
        </header>

        {/* List */}
        <section className="mt-6">
          {list.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              No more nearby options yet. Go back and try another vibe.
            </div>
          ) : (
            <div className="space-y-4">
              {list.map((v) => (
                <VenueRow
                  key={v.id}
                  venue={v}
                  onClick={() => router.push(`/venue/${v.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}