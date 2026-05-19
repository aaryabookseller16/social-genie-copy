// components/results/ResultsScreen.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HamburgerMenu from "@/components/nav/HamburgerMenu";
import { pickVenueImage } from "@/app/lib/image";
import MicFab from "../home/MicFab";

type ResultVenue = {
  id: string | number;
  venue_name: string;
  area_neighborhood?: string | null;
  vibe_notes?: string | null;
  image?: string | null;
  tags?: string[];
};

const STORAGE_RESULTS_KEY = "genie_last_results_v1"; // top_venues mapped (max 3)
const STORAGE_MORE_KEY = "genie_last_more_v1"; // more_venues mapped (8-12)
const STORAGE_REPLY_KEY = "genie_last_reply_v1";

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

function VenueCard({
  venue,
  onClick,
  size = "featured",
}: {
  venue: ResultVenue;
  onClick?: () => void;
  size?: "featured" | "mini";
}) {
  const chips =
    venue.tags && venue.tags.length
      ? venue.tags.slice(0, 3)
      : (venue.vibe_notes || "")
          .split(/[·,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3);

  const cardClass =
    size === "featured"
      ? "rounded-[32px] md:rounded-[36px]"
      : "rounded-[28px] md:rounded-[30px]";

  const imageHeight =
    size === "featured" ? "h-[240px] md:h-[260px]" : "h-[130px] md:h-[140px]";

  const padding = size === "featured" ? "p-5" : "p-4";
  const titleSize = size === "featured" ? "text-[20px]" : "text-[16px]";
  const subSize = size === "featured" ? "text-sm" : "text-[13px]";
  const chipSize = size === "featured" ? "text-xs" : "text-[11px]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "text-left overflow-hidden border shadow-sm transition",
        "bg-white/70 dark:bg-black/25",
        "border-white/50 dark:border-white/10",
        "hover:shadow-md active:scale-[0.99]",
        cardClass,
        "w-full",
      ].join(" ")}
    >
      <div className={`relative w-full ${imageHeight}`}>
        {(() => {
          const src = pickVenueImage(venue);
          const remote = isRemoteUrl(src);

          return remote ? (
            <img
              src={src}
              alt={venue.venue_name}
              className="absolute inset-0 h-full w-full object-cover"
              loading={size === "featured" ? "eager" : "lazy"}
              referrerPolicy="no-referrer"
            />
          ) : (
            <Image
              src={src}
              alt={venue.venue_name}
              fill
              className="object-cover"
              priority={size === "featured"}
            />
          );
        })()}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
      </div>

      <div className={padding}>
        <div
          className={`${titleSize} leading-tight font-semibold text-zinc-900 dark:text-zinc-100`}
        >
          {venue.venue_name}
        </div>

        <div className={`mt-1 ${subSize} text-zinc-600 dark:text-zinc-300`}>
          {venue.area_neighborhood || "—"}
        </div>

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((t, idx) => (
              <span
                key={`${t}-${idx}`}
                className={[
                  chipSize,
                  "px-3 py-1 rounded-full",
                  "bg-black/5 dark:bg-white/10",
                  "text-zinc-700 dark:text-zinc-200",
                ].join(" ")}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

export default function ResultsScreen() {
  const router = useRouter();

  const [reply, setReply] = useState<string>(
    "Got you — I pulled some spots that match your vibe. Check these out."
  );
  const [venues, setVenues] = useState<ResultVenue[]>([]);
  const [refine, setRefine] = useState("");

  // V1: results screen is render-only — HomeScreen already fetched + stored
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedReply = window.localStorage.getItem(STORAGE_REPLY_KEY);
    const storedResults = window.localStorage.getItem(STORAGE_RESULTS_KEY);

    const parsedReply = storedReply || "";
    const parsedResults = safeParse<ResultVenue[]>(storedResults, []);

    if (parsedReply.trim()) setReply(parsedReply);

    if (Array.isArray(parsedResults)) {
      setVenues(parsedResults);
    }
  }, []);

  const top3 = useMemo(() => venues.slice(0, 3), [venues]);

  // Minimal refine behavior: route back home with q param (optional wiring later)
  const runRefine = (textRaw: string) => {
    const clean = (textRaw || "").trim();
    if (!clean) return;
    router.push(`/?q=${encodeURIComponent(clean)}`);
  };

  const hasMoreNearby = useMemo(() => {
    if (typeof window === "undefined") return false;
    const raw = window.localStorage.getItem(STORAGE_MORE_KEY);
    const parsed = safeParse<ResultVenue[]>(raw, []);
    return Array.isArray(parsed) && parsed.length > 0;
  }, []);

  return (
    <main className="min-h-screen relative overflow-hidden bg-zinc-50 dark:bg-black">
      {/* Background glow / texture approximation */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] h-[680px] rounded-full blur-3xl bg-red-500/20 dark:bg-red-600/25" />
        <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.10] bg-[radial-gradient(circle_at_20%_20%,#ef4444,transparent_45%),radial-gradient(circle_at_80%_30%,#ef4444,transparent_40%),radial-gradient(circle_at_50%_80%,#ef4444,transparent_45%)]" />
      </div>

      {/* CONTENT WRAPPER */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-6 pb-10">
        {/* HEADER ROW (back + logo left, hamburger right) */}
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

            <button
              type="button"
              onClick={() => router.push("/")}
              aria-label="Go home"
              className="relative h-10 w-10"
            >
              <Image
                src="/sb-logo-icon.png"
                alt="Social Bevy"
                fill
                className="object-contain"
                priority
              />
            </button>
          </div>

          <HamburgerMenu />
        </header>

        {/* Genie bubble row */}
        <section className="mt-6">
          <div className="flex items-start gap-4">
            <div className="relative w-[96px] h-[96px] rounded-3xl overflow-hidden border border-white/50 dark:border-white/10 shadow-sm bg-white/40">
              <Image
                src="/genie-pic2.png"
                alt="Genie"
                fill
                className="object-cover"
                style={{ objectPosition: "50% 14%" }}
                priority
              />
            </div>

            <div className="rounded-3xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-white/10 backdrop-blur-md px-5 py-3 shadow-sm w-full max-w-[520px]">
              <p className="text-[17px] leading-snug text-zinc-800 dark:text-zinc-100 whitespace-pre-line">
                {reply}
              </p>
            </div>
          </div>
        </section>

        {/* Top 3 only */}
        <section className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {top3.map((v) => (
              <VenueCard
                key={v.id}
                venue={v}
                size="featured"
                onClick={() => router.push(`/venue/${v.id}`)}
              />
            ))}
          </div>

          {top3.length === 0 && (
            <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
              I don’t have enough to recommend yet. Try refining your vibe.
            </div>
          )}
        </section>

        {/* See more nearby CTA */}
        <section className="mt-6">
          <button
            type="button"
            onClick={() => router.push("/results/more")}
            className="w-full rounded-2xl border border-zinc-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 backdrop-blur px-5 py-4 shadow-md text-left hover:shadow-lg transition"
            disabled={!hasMoreNearby}
            aria-disabled={!hasMoreNearby}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[16px] font-semibold text-zinc-900 dark:text-zinc-100">
                  See more nearby →
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-300">
                  {hasMoreNearby
                    ? "8–12 more options around you"
                    : "No more nearby options saved yet"}
                </div>
              </div>
              <div className="text-xl">›</div>
            </div>
          </button>
        </section>

        {/* Bottom refine input */}
        <section className="mt-10 flex justify-center">
          <div className="w-full max-w-[640px]">
            <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 backdrop-blur px-5 py-4 shadow-md">
              <span className="text-zinc-500">🔍</span>

              <input
                value={refine}
                onChange={(e) => setRefine(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runRefine(refine);
                }}
                placeholder="Refine your vibe..."
                className="flex-1 bg-transparent outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-[15px]"
              />

              <div className="shrink-0">
                <MicFab
                  onResult={(text: string) => runRefine(text)}
                  onFallback={() => runRefine(refine)}
                  onTranscript={(text: string) => setRefine(text)}
                  onListeningChange={() => {}}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}