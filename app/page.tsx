"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { fetchGenieVenues, type GenieVenue, callGenie } from "./lib/genieClient";
import {
  trackQuery,
  trackVenueClick,
  trackShare,
  trackWeeklySignup,
} from "./lib/analytics";

console.log("Genie API:", process.env.NEXT_PUBLIC_GENIE_API_URL);

type Venue = GenieVenue;

const STORAGE_KEY = "genie_saved_venues_v1";

export default function Home() {
  const [genieReply, setGenieReply] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [results, setResults] = useState<Venue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // ✅ Thinking indicator (orb)
  const [isThinking, setIsThinking] = useState(false);
  const thinkingStartRef = useRef<number>(0);

  const startThinking = () => {
    thinkingStartRef.current = Date.now();
    setIsThinking(true);
  };

  const stopThinking = async () => {
    const elapsed = Date.now() - thinkingStartRef.current;
    const MIN_MS = 800; // ensures users see the orb even on fast responses
    if (elapsed < MIN_MS) {
      await new Promise((r) => setTimeout(r, MIN_MS - elapsed));
    }
    setIsThinking(false);
  };

  // Weekly picks modal
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [weeklyContact, setWeeklyContact] = useState("");
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  // Voice
  const recognitionRef = useRef<any>(null);

  // Saved spots
  const [savedVenues, setSavedVenues] = useState<Venue[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  const router = useRouter();
  const hasResults = results.length > 0;

  const refreshSavedFromStorage = () => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];

      if (!Array.isArray(ids) || ids.length === 0) {
        setSavedVenues([]);
        return;
      }

      fetchGenieVenues({ limit: 200 })
        .then((genieVenues: GenieVenue[]) => {
          const list = genieVenues.filter((v: GenieVenue) =>
            ids.includes(String(v.id))
          );
          setSavedVenues(list);
        })
        .catch((err) => {
          console.error("Failed to load Genie venues:", err);
        });
    } catch (e) {
      console.error("Error reading saved venues:", e);
    }
  };

  useEffect(() => {
    refreshSavedFromStorage();
  }, []);

  const handleToggleSavedView = () => {
    refreshSavedFromStorage();
    setShowSaved((prev) => !prev);
    setMessage(null);
    if (!showSaved) setResults([]);
  };

  const startListening = () => {
    const SpeechRecognition =
      // @ts-ignore
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input not supported on this device.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      runSearch(transcript);
    };

    recognition.start();
  };

  const runSearch = async (queryRaw: string) => {
    const query = queryRaw.trim().toLowerCase();
    if (!query) return;

    trackQuery(queryRaw);

    // ✅ start thinking immediately
    startThinking();

    setIsSearching(true);
    setMessage(null);
    setShowSaved(false);
    setGenieReply(null);

    try {
      const genieVenues = await fetchGenieVenues({
        limit: 20,
        energy_level_filter: "",
        music_filter: "",
        crowd_filter: "",
      });

      const filtered = genieVenues.filter((v: GenieVenue) => {
        const haystack = `${v.venue_name} ${v.area_neighborhood ?? ""} ${
          v.vibe_notes ?? ""
        } ${v.address ?? ""}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      });

      const hasAny = filtered.length > 0;

      if (!hasAny) {
        setResults([]);
        setMessage(
          "My bad, I can't find that vibe in Genie’s brain yet. I’ll still try to help you out."
        );
      } else {
        setResults(filtered);
        setMessage(null);
      }

      const topVenues = filtered.slice(0, 5).map((v) => ({
        name: v.venue_name,
        neighborhood: v.area_neighborhood,
        vibe_notes: v.vibe_notes,
      }));

      const res = await fetch("/api/genie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryRaw,
          city: "Houston",
          hasResults: hasAny,
          topVenues,
        }),
      });

      if (!res.ok) {
        console.error("Genie API failed:", await res.text());
        setGenieReply(
          "I pulled up what I could, but something glitched with my chat. Check the cards below."
        );
      } else {
        const data = await res.json();
        setGenieReply(data.reply || null);
      }
    } catch (err) {
      console.error("Genie search failed:", err);
      setMessage("Something went wrong talking to Genie. Try again.");
      setGenieReply(
        "Something hiccupped on my side. Give that request one more try."
      );
    } finally {
      setIsSearching(false);
      await stopThinking(); // ✅ ensure orb shows for minimum time
    }
  };

  const handleHomeShare = async () => {
    try {
      const shareUrl = window.location.href;
      const shareText =
        "Check out Social Genie — your AI-powered social concierge!";

      if (navigator.share) {
        await navigator.share({
          title: "Social Genie",
          text: shareText,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert("Link copied! Share Genie with your friends.");
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    // ✅ start thinking immediately
    startThinking();

    setIsSearching(true);
    setMessage(null);
    setGenieReply(null);
    setResults([]);
    setShowSaved(false);

    try {
      const data = await callGenie(trimmed);
      setGenieReply(data.reply || null);

      if (data.use_xano) {
        const filters = data.filters || {};

        const xanoResults = await fetchGenieVenues({
          limit: 24,
          city_filter: filters.city ?? "",
          energy_level_filter: filters.energy ?? "",
          music_filter: filters.music ?? "",
          crowd_filter: filters.crowd ?? "",
          vibe_filter: Array.isArray(filters.vibe_keywords)
            ? filters.vibe_keywords.join(" ")
            : "",
        });

        setResults(xanoResults || []);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error("Genie search failed:", err);
      setMessage(
        "Genie had a hiccup reaching her magic. Try again in a moment."
      );
    } finally {
      setIsSearching(false);
      await stopThinking(); // ✅ ensure orb shows for minimum time
    }
  };

  const handleWeeklySubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = weeklyContact.trim();
    if (!value) {
      setWeeklyError("Add your email or phone so Genie can send picks.");
      return;
    }

    setWeeklyError(null);
    trackWeeklySignup(value);
    setShowWeeklyModal(false);
    setWeeklyContact("");
    alert("You’re on Genie’s list. Weekly picks coming soon.");
  };

  return (
    <main className="min-h-screen flex flex-col items-center pt-6 px-4 pb-32 bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      {/* Title */}
      <h1 className="text-3xl font-semibold mb-2 text-center text-zinc-900 dark:text-zinc-100">
        Hey, I&apos;m Genie.
      </h1>

      {/* Glow + Genie */}
      <div className="relative flex flex-col items-center justify-center mt-0 mb-4">
        <div className="absolute top-0 w-[280px] h-[280px] bg-red-300/40 dark:bg-red-500/20 rounded-full blur-3xl" />

        <Image
          src="/genie-pic2.png"
          alt="Genie"
          width={330}
          height={330}
          className="relative z-20 mt-2"
        />
      </div>

      {/* Thinking Orb */}
      {isThinking && (
        <div className="mt-2 mb-2 flex flex-col items-center justify-center">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full blur-xl animate-orbGlow bg-red-500/20 dark:bg-red-500/30" />

            <Image
              src="/orb.png"
              alt="Genie is thinking"
              fill
              sizes="64px"
              className="
                object-contain animate-orbPulse
                drop-shadow-[0_0_18px_rgba(239,68,68,0.25)]
                dark:drop-shadow-[0_0_24px_rgba(239,68,68,0.45)]
              "
              priority
            />
          </div>

          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Genie’s thinking…
          </p>
        </div>
      )}

      {/* Genie conversational reply */}
      {genieReply && (
        <div className="w-full max-w-md mb-3">
          <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/60 px-4 py-3 shadow-sm">
            <p className="text-sm whitespace-pre-line text-zinc-700 dark:text-zinc-200">
              {genieReply}
            </p>
          </div>
        </div>
      )}

      {/* Results OR Saved Spots */}
      <section className="w-full max-w-md mb-28">
        {showSaved ? (
          <>
            <h2 className="text-sm font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              Your saved spots
            </h2>

            {savedVenues.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                You haven&apos;t saved any spots yet. Ask Genie for a vibe, then
                tap <span className="font-medium">Save this spot</span> on a
                venue.
              </p>
            ) : (
              <div className="space-y-4">
                {savedVenues.map((venue) => (
                  <button
                    key={venue.id}
                    type="button"
                    onClick={() => {
                      (trackVenueClick as any)({
                        venueId: String(venue.id),
                        venueName: venue.venue_name,
                        position: 0,
                        queryText: input,
                        city: venue.city ?? "",
                      });
                      router.push(`/venue/${venue.id}`);
                    }}
                    className="w-full text-left rounded-3xl border border-zinc-200/70 dark:border-zinc-800 shadow-sm overflow-hidden bg-white/80 dark:bg-zinc-900/50 hover:shadow-md transition"
                  >
                    <div className="flex">
                      <div className="relative w-24 h-24 flex-shrink-0 bg-zinc-100 dark:bg-zinc-900">
                        <Image
                          src={
                            (venue as any).image ||
                            (venue as any).image_url ||
                            "/sample-venue-1.jpeg"
                          }
                          alt={venue.venue_name || "Venue photo"}
                          fill
                          className="object-cover"
                          priority
                        />
                      </div>
                      <div className="flex-1 px-4 py-3">
                        <h3 className="text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
                          {venue.venue_name}
                        </h3>
                        <p className="text-xs mb-1 text-zinc-600 dark:text-zinc-400">
                          {venue.area_neighborhood}
                          {venue.city ? ` · ${venue.city}` : ""}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                          {venue.vibe_notes}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {hasResults && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowWeeklyModal(true)}
                  className="text-xs font-medium text-red-600 dark:text-red-400 underline"
                >
                  Get Genie&apos;s weekly picks
                </button>
              </div>
            )}

            {hasResults && (
              <div className="space-y-4">
                {results.map((venue, index) => (
                  <button
                    key={venue.id}
                    type="button"
                    onClick={() => {
                      (trackVenueClick as any)({
                        venueId: String(venue.id),
                        venueName: venue.venue_name,
                        position: index,
                        queryText: input,
                        city: venue.city ?? "",
                      });
                      router.push(`/venue/${venue.id}`);
                    }}
                    className="w-full text-left rounded-3xl border border-zinc-200/70 dark:border-zinc-800 shadow-sm overflow-hidden bg-white/80 dark:bg-zinc-900/50 hover:shadow-md transition"
                  >
                    <div className="flex">
                      <div className="relative w-24 h-24 flex-shrink-0 bg-zinc-100 dark:bg-zinc-900">
                        <Image
                          src={venue.image || "/sample-venue-1.jpeg"}
                          alt={venue.venue_name || "Venue"}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 px-4 py-3">
                        <h3 className="text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
                          {venue.venue_name}
                        </h3>
                        <p className="text-xs mb-1 text-zinc-600 dark:text-zinc-400">
                          {venue.area_neighborhood}
                          {venue.city ? ` · ${venue.city}` : ""}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                          {venue.vibe_notes}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!hasResults && message && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {message}
              </p>
            )}
          </>
        )}
      </section>

      {/* Sticky Input + icons */}
      <div className="fixed bottom-6 left-0 right-0 px-4 z-30">
        <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
          <div className="relative w-full group">
            <div
              className="
                absolute inset-0 -z-10 rounded-full
                bg-white/70 dark:bg-black/40 backdrop-blur-md
                border border-zinc-200/60 dark:border-red-500/40
                shadow-sm
                group-focus-within:border-red-500/70
                group-focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.25)]
              "
            />

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isSearching
                  ? "Genie is thinking..."
                  : "How can I get you social today?"
              }
              className="
                w-full py-4 pl-5 pr-14 rounded-full
                bg-transparent
                text-zinc-900 dark:text-zinc-100
                placeholder-red-500 dark:placeholder-red-400
                focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-500/40
              "
            />

            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3 text-red-600 dark:text-red-400">
              <button
                type="button"
                onClick={startListening}
                aria-label="Speak to Genie"
              >
                🎤
              </button>

              <button
                type="button"
                onClick={handleToggleSavedView}
                aria-label="View saved spots"
              >
                <Image
                  src="/save-icon.png"
                  alt="Saved spots"
                  width={18}
                  height={18}
                  className="object-contain dark:invert"
                />
              </button>

              <button
                type="button"
                onClick={handleHomeShare}
                aria-label="Share Genie"
              >
                <Image
                  src="/share-icon.png"
                  alt="Share"
                  width={18}
                  height={18}
                  className="object-contain dark:invert"
                />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Weekly Picks Modal */}
      {showWeeklyModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl p-5 shadow-xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <h2 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              Get Genie&apos;s weekly picks
            </h2>
            <p className="text-sm mb-3 text-zinc-600 dark:text-zinc-400">
              Drop your email or phone number and Genie will send you curated
              vibes each week.
            </p>

            <form onSubmit={handleWeeklySubmit}>
              <input
                value={weeklyContact}
                onChange={(e) => setWeeklyContact(e.target.value)}
                placeholder="email or phone"
                className="
                  w-full mb-2 px-3 py-2 rounded-lg text-sm
                  border border-zinc-200 dark:border-zinc-800
                  bg-white dark:bg-zinc-900
                  text-zinc-900 dark:text-zinc-100
                  placeholder:text-zinc-500 dark:placeholder:text-zinc-400
                  focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-500/40
                "
              />
              {weeklyError && (
                <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                  {weeklyError}
                </p>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowWeeklyModal(false)}
                  className="text-sm text-zinc-600 dark:text-zinc-400"
                >
                  Not now
                </button>
                <button
                  type="submit"
                  className="text-sm font-semibold text-white bg-red-600 hover:bg-red-500 px-4 py-2 rounded-full"
                >
                  Get picks
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
