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

  // ---------- Saved spots helpers ----------

  const refreshSavedFromStorage = () => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];

      console.log("[HOME] raw from localStorage:", raw);
      console.log("[HOME] parsed IDs:", ids);

      if (!Array.isArray(ids) || ids.length === 0) {
        console.log("[HOME] No saved IDs found");
        setSavedVenues([]);
        return;
      }

      fetchGenieVenues({ limit: 200 })
  .then((genieVenues: GenieVenue[]) => {
    console.log("[HOME] fetched venues count:", genieVenues.length);

    const list = genieVenues.filter((v: GenieVenue) =>
      ids.includes(String(v.id)) // compare string to string
    );

    console.log("[HOME] matched saved venues count:", list.length);
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
    // On mount, load any saved spots
    refreshSavedFromStorage();
  }, []);

  const handleToggleSavedView = () => {
    // Always refresh in case user just saved/unsaved somewhere else
    refreshSavedFromStorage();
    setShowSaved((prev) => !prev);
    setMessage(null);
    // When showing saved spots, clear active search results
    if (!showSaved) {
      setResults([]);
    }
  };

  // ---------- Voice input ----------

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

  // ---------- Search / Home share ----------

  const runSearch = async (queryRaw: string) => {
    const query = queryRaw.trim().toLowerCase();
    if (!query) return;

    // Analytics
    trackQuery(queryRaw);

    setIsSearching(true);
    setMessage(null);
    setShowSaved(false); // leave saved mode when searching
    setGenieReply(null); // clear last Genie message

    try {
      // 1) Get venues from Xano (what you already had)
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

      // 2) Call conversational Genie API
      // Build a light summary of the top venues to feed the model
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
          city: "Houston", // you can make this dynamic later
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
    }
  };

  const handleHomeShare = async () => {
    try {
      const shareUrl = window.location.href;
      const shareText = "Check out Social Genie — your AI-powered social concierge!";

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

    setIsSearching(true);
    setMessage(null);
    setGenieReply(null);
    setResults([]);
    setShowSaved(false); // keep hiding Saved when doing a fresh search

    try {
      // 1) Talk directly to Genie (Xano) via callGenie
      const data = await callGenie(trimmed);

      // Genie’s conversational reply
      setGenieReply(data.reply || null);

      // 2) Optional Xano step — only runs once Genie tells us to use_xano + filters
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
        // Genie is handling this with pure AI (no Xano matches)
        setResults([]);
      }
    } catch (err) {
      console.error("Genie search failed:", err);
      setMessage(
        "Genie had a hiccup reaching her magic. Try again in a moment."
      );
    } finally {
      setIsSearching(false);
    }
  };

  // ---------- Weekly picks ----------

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

  // ---------- Render ----------

  return (
    <main className="min-h-screen flex flex-col items-center pt-6 px-4 pb-32">
      {/* Title */}
      <h1 className="text-3xl font-semibold text-gray-900 mb-2 text-center">
        Hey, I&apos;m Genie.
      </h1>

      {/* Glow + Genie */}
      <div className="relative flex flex-col items-center justify-center mt-0 mb-4">
        <div className="absolute top-0 w-[280px] h-[280px] bg-red-300/40 rounded-full blur-3xl"></div>

        <Image
          src="/genie-pic.png"
          alt="Genie"
          width={330}
          height={330}
          className="relative z-20 mt-2"
        />
      </div>

      {/* Genie conversational reply */}
      {genieReply && (
        <p className="text-sm text-gray-700 whitespace-pre-line">
          {genieReply}
        </p>
      )}

      {/* Results OR Saved Spots */}
      <section className="w-full max-w-md mb-28">
        {/* Saved spots inline */}
        {showSaved ? (
          <>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              Your saved spots
            </h2>

            {savedVenues.length === 0 ? (
              <p className="text-sm text-gray-500">
                You haven&apos;t saved any spots yet. Ask Genie for a vibe, then
                tap{" "}
                <span className="font-medium">Save this spot</span> on a venue.
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

                    className="w-full text-left rounded-3xl border border-gray-100 shadow-sm overflow-hidden bg-white hover:shadow-md transition"
                  >
                    <div className="flex">
                      <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100">
                        <Image
                          src={
                            (venue as any).image ||
                            (venue as any).image_url ||
                            "/sample-venue-1.jpeg"
                          }
                          alt={
                            venue.venue_name ||
                            (venue as any).name ||
                            "Venue photo"
                          }
                          fill
                          className="object-cover"
                          priority
                        />
                      </div>
                      <div className="flex-1 px-4 py-3">
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">
                          {venue.venue_name}
                        </h3>
                        <p className="text-xs text-gray-500 mb-1">
                          {venue.area_neighborhood}
                          {venue.city ? ` · ${venue.city}` : ""}
                        </p>
                        <p className="text-xs text-red-500 font-medium">
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
            {/* Weekly picks CTA appears only when there ARE results */}
            {hasResults && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowWeeklyModal(true)}
                  className="text-xs font-medium text-red-500 underline"
                >
                  Get Genie&apos;s weekly picks
                </button>
              </div>
            )}

            {/* Results list */}
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

                    className="w-full text-left rounded-3xl border border-gray-100 shadow-sm overflow-hidden bg-white hover:shadow-md transition"
                  >
                    <div className="flex">
                      <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100">
                        <Image
                          src={venue.image || "/sample-venue-1.jpeg"} // <-- fallback
                          alt={venue.venue_name || "Venue"} // <-- real alt text
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 px-4 py-3">
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">
                          {venue.venue_name} {/* <-- was venue.name */}
                        </h3>
                        <p className="text-xs text-gray-500 mb-1">
                          {venue.area_neighborhood}
                          {venue.city ? ` · ${venue.city}` : ""}
                        </p>
                        <p className="text-xs text-red-500 font-medium">
                          {venue.vibe_notes}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No-results message */}
            {!hasResults && message && (
              <p className="text-sm text-gray-500">{message}</p>
            )}
          </>
        )}
      </section>

      {/* Sticky Input + icons */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md fixed bottom-10 px-4"
      >
        <div className="relative w-full">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isSearching
                ? "Genie is thinking..."
                : "How can I get you social today?"
            }
            className="
              w-full py-4 pl-5 pr-14 rounded-full shadow-md 
              border border-gray-200 text-gray-800 placeholder-red-500
              focus:outline-none focus:ring-2 focus:ring-red-300
            "
          />

          {/* Icons: mic, saved, share */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3 text-red-500">
            {/* Mic */}
            <button
              type="button"
              onClick={startListening}
              aria-label="Speak to Genie"
            >
              🎤
            </button>

            {/* Saved spots */}
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
                className="object-contain"
              />
            </button>

            {/* Share app */}
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
                className="object-contain"
              />
            </button>
          </div>
        </div>
      </form>

      {/* Weekly Picks Modal */}
      {showWeeklyModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Get Genie&apos;s weekly picks
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              Drop your email or phone number and Genie will send you curated
              vibes each week.
            </p>

            <form onSubmit={handleWeeklySubmit}>
              <input
                value={weeklyContact}
                onChange={(e) => setWeeklyContact(e.target.value)}
                placeholder="email or phone"
                className="w-full mb-2 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              {weeklyError && (
                <p className="text-xs text-red-500 mb-2">{weeklyError}</p>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowWeeklyModal(false)}
                  className="text-sm text-gray-500"
                >
                  Not now
                </button>
                <button
                  type="submit"
                  className="text-sm font-semibold text-white bg-red-500 px-4 py-2 rounded-full"
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
