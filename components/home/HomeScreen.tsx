// HomeScreen.tsx - the main landing page with the genie and search input
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import GenieStage from "./GenieStage";
import MicFab from "./MicFab";
import HomeBackground from "./HomeBackground";
import TopBar from "./TopBar";
import HamburgerMenu from "@/components/nav/HamburgerMenu";

import { callGenie, type GenieVenue } from "@/app/lib/genieClient";
import { useGenieLocation } from "@/app/lib/genie/useGenieLocation";

const STORAGE_RESULTS_KEY = "genie_last_results_v1";
const STORAGE_REPLY_KEY = "genie_last_reply_v1";
const STORAGE_MORE_KEY = "genie_last_more_v1";

type ResultVenue = {
  id: string | number;
  venue_name: string;
  area_neighborhood?: string | null;
  address?: string | null;
  vibe_notes?: string | null;

  image?: string | null;
  image_primary_url?: string | null;
  image_fallback_url?: string | null;

  website_url?: string | null;
  instagram_handle?: string | null;

  tags?: string[];
};

function toResultVenue(v: GenieVenue): ResultVenue {
  const vibe = (v as any).vibe_notes ?? null;

  const tags =
    typeof vibe === "string" && vibe.trim()
      ? vibe
          .split(/[·,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

  const imagePrimary = (v as any).image_primary_url ?? null;
  const imageFallback = (v as any).image_fallback_url ?? null;
  const finalImage = imagePrimary || imageFallback || "/placeholder-venue.png";

  return {
    id:
      (v as any).id ??
      (v as any).venue_id ??
      (v as any).external_id ??
      String(Math.random()),
    venue_name: (v as any).venue_name ?? "Venue",
    area_neighborhood: (v as any).area_neighborhood ?? null,
    address: (v as any).address ?? null,
    vibe_notes: vibe,
    image: finalImage,
    image_primary_url: imagePrimary,
    image_fallback_url: imageFallback,
    website_url: (v as any).website_url ?? null,
    instagram_handle: (v as any).instagram_handle ?? null,
    tags,
  };
}

function ThinkingOrb() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute h-[160px] w-[160px] sm:h-[180px] sm:w-[180px] md:h-[210px] md:w-[210px] rounded-full blur-3xl bg-red-500/30 dark:bg-red-500/25" />
      <div className="relative h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28">
        <Image
          src="/orb.png"
          alt="Genie thinking orb"
          fill
          className="object-contain animate-[orbPulse_1.6s_ease-in-out_infinite]"
          priority
        />
      </div>

      <style jsx>{`
        @keyframes orbPulse {
          0% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.06);
            filter: brightness(1.08);
          }
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
        }
      `}</style>
    </div>
  );
}

function TranscriptBox({
  listening,
  showConfirm,
  draftText,
  setDraftText,
  onRetry,
  onConfirm,
}: {
  listening: boolean;
  showConfirm: boolean;
  draftText: string;
  setDraftText: (v: string) => void;
  onRetry: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/80 dark:bg-white/10 backdrop-blur-md px-4 py-3 shadow-sm">
        <div className="text-xs text-zinc-600 dark:text-zinc-300 mb-1">
          {listening ? "Listening…" : "You said:"}
        </div>

        <input
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Try: happy hour, brunch, sports bar, rooftop…"
          className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
        />

        {showConfirm && (
          <div className="mt-3 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 rounded-full text-sm text-zinc-700 dark:text-zinc-200 bg-black/5 dark:bg-white/10"
            >
              Retry
            </button>

            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-2 rounded-full text-sm font-semibold text-white bg-red-600 hover:bg-red-500"
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") || "").trim();

  const [isLoading, setIsLoading] = useState(false);

  // shared speech UX (mobile + web)
  const [listening, setListening] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // web typing UX
  const [webQuery, setWebQuery] = useState("");

  // ✅ hook must be inside component
  const geo = useGenieLocation();

  const runGenieAndGo = async (textRaw: string) => {
  const text = (textRaw || "").trim();
  if (!text) return;

  setIsLoading(true);
  setListening(false);
  setShowConfirm(false);

  try {
    let lat = geo.lat ?? null;
    let lng = geo.lng ?? null;

    if (!lat || !lng) {
      const r = await geo.requestLocation();
      lat = r.lat;
      lng = r.lng;
    }

    const data = await callGenie(text, {
      lat,
      lng,
      radius_meters: 2000,
      location_label: "",
    });

    const reply = (data?.reply ?? "").toString();

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_REPLY_KEY, reply);
    }

    if (data?.needs_location === true) {
      setDraftText("Enable location so I can show the closest spots.");
      setShowConfirm(true);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_RESULTS_KEY, JSON.stringify([]));
        window.localStorage.setItem(STORAGE_MORE_KEY, JSON.stringify([]));
      }
      return;
    }

    const topVenues: GenieVenue[] = Array.isArray((data as any)?.top_venues)
      ? ((data as any).top_venues as GenieVenue[])
      : [];

    const moreVenues: GenieVenue[] = Array.isArray((data as any)?.more_venues)
      ? ((data as any).more_venues as GenieVenue[])
      : [];

    const mappedTop = topVenues.map(toResultVenue);
    const mappedMore = moreVenues.map(toResultVenue);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_RESULTS_KEY, JSON.stringify(mappedTop));
      window.localStorage.setItem(STORAGE_MORE_KEY, JSON.stringify(mappedMore));
    }

    router.push(`/results?q=${encodeURIComponent(text)}`);
  } catch (e) {
    console.error("HomeScreen runGenieAndGo error:", e);
    router.push("/results");
  } finally {
    setIsLoading(false);
  }
};

  // ✅ Option 1 refine: if /?q=... run once, then clear URL
  useEffect(() => {
    if (!q) return;

    router.replace("/");
    runGenieAndGo(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // ...keep the rest of your handlers + return JSX below

  const submitWebQuery = () => {
    const clean = webQuery.trim();
    if (!clean) return;
    runGenieAndGo(clean);
  };

  // Speech handlers
  const onMicTranscript = (text: string) => setDraftText(text);

  const onMicResult = (text: string) => {
    setListening(false);
    setDraftText(text);
    setShowConfirm(true);
  };

  const onFallback = () => {
    setListening(false);
    setDraftText("");
    setShowConfirm(true);
  };

  const showTranscript = !isLoading && (listening || showConfirm);
  const showThinking = isLoading;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <HomeBackground />

      {/* ✅ WEB HEADER (md+) */}
      <div className="hidden md:block relative z-20 w-full">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <div className="relative h-10 w-10">
            <Image
              src="/sb-logo-icon.png"
              alt="Social Bevy"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-4">
            <button
              aria-label="Notifications"
              className="h-10 w-10 rounded-full bg-white/70 dark:bg-white/10 border border-zinc-200/60 dark:border-white/10 backdrop-blur shadow-sm"
            >
              🔔
            </button>

            <HamburgerMenu />
          </div>
        </div>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden">
        <TopBar />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md md:max-w-6xl flex-col items-center px-6 pt-20 pb-20">
        <h1 className="text-center text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100 -mt-6">
          What&apos;s your vibe today?
        </h1>

        <div className="mt-8 flex flex-1 items-center justify-center pointer-events-none relative z-10">
          <GenieStage />
        </div>

        {/* =========================
            WEB DOCK (md+)
        ========================= */}
        <div className="hidden md:flex w-full justify-center relative z-50 -translate-y-36">
          <div className="w-full max-w-2xl">
            {showThinking && (
              <div className="flex flex-col items-center gap-3">
                <div className="px-4 py-2 rounded-full text-sm bg-white/85 dark:bg-black/60 border border-zinc-200/60 dark:border-white/10 backdrop-blur shadow-md text-zinc-800 dark:text-zinc-100">
                  Genie&apos;s thinking...
                </div>
                <ThinkingOrb />
              </div>
            )}

            {!showThinking && showTranscript && (
              <TranscriptBox
                listening={listening}
                showConfirm={showConfirm}
                draftText={draftText}
                setDraftText={setDraftText}
                onRetry={() => {
                  setDraftText("");
                  setShowConfirm(false);
                }}
                onConfirm={() => {
                  const clean = draftText.trim();
                  if (!clean) return;
                  setShowConfirm(false);
                  runGenieAndGo(clean);
                }}
              />
            )}

            {!showThinking && !showTranscript && (
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 backdrop-blur px-4 py-3 shadow-sm">
                <span className="text-zinc-500">🔍</span>

                <input
                  value={webQuery}
                  onChange={(e) => setWebQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitWebQuery();
                  }}
                  placeholder="Tell Genie what you're in the mood for..."
                  className="flex-1 bg-transparent outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />

                <div className="shrink-0">
                  <MicFab
                    onResult={onMicResult}
                    onFallback={onFallback}
                    onTranscript={onMicTranscript}
                    onListeningChange={(v) => {
                      setListening(v);
                      if (v) setShowConfirm(false);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =========================
            MOBILE DOCK (md-)
        ========================= */}
        <div className="md:hidden relative z-30 mt-6 mb-6 flex w-full justify-center">
          <div className="relative z-50 w-full max-w-md flex justify-center pointer-events-auto">
            {showThinking && (
              <div className="absolute bottom-full mb-6 w-full flex flex-col items-center gap-3 z-50">
                <div className="px-4 py-2 rounded-full text-sm bg-white/85 dark:bg-black/60 border border-white/40 dark:border-white/10 backdrop-blur shadow-md text-zinc-800 dark:text-zinc-100">
                  Genie&apos;s thinking...
                </div>
                <ThinkingOrb />
              </div>
            )}

            {showTranscript && (
              <div className="absolute bottom-full mb-4 w-full px-2 z-50">
                <TranscriptBox
                  listening={listening}
                  showConfirm={showConfirm}
                  draftText={draftText}
                  setDraftText={setDraftText}
                  onRetry={() => {
                    setDraftText("");
                    setShowConfirm(false);
                  }}
                  onConfirm={() => {
                    const clean = draftText.trim();
                    if (!clean) return;
                    setShowConfirm(false);
                    runGenieAndGo(clean);
                  }}
                />
              </div>
            )}

            <div className="-translate-y-12">
              {!showThinking && (
                <MicFab
                  onResult={onMicResult}
                  onFallback={onFallback}
                  onTranscript={onMicTranscript}
                  onListeningChange={(v) => {
                    setListening(v);
                    if (v) setShowConfirm(false);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
