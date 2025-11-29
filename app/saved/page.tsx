"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { venues } from "../venue/data";

type Venue = (typeof venues)[number];

const STORAGE_KEY = "genie_saved_venues_v1";

export default function SavedPage() {
  const [savedVenues, setSavedVenues] = useState<Venue[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(ids) || ids.length === 0) {
        setSavedVenues([]);
      } else {
        const genieVenues = await fetchGenieVenues({ limit: 200 }); // load all
const list = genieVenues.filter((v) => ids.includes(v.id));
setSavedVenues(list);

      }
    } catch {
      setSavedVenues([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  const hasAny = savedVenues.length > 0;

  return (
    <main className="min-h-screen bg-white flex flex-col px-4 pt-10 pb-6">
      {/* Header */}
      <header className="max-w-md mx-auto w-full flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Saved spots
        </h1>
        <Link href="/" className="text-sm text-red-500 underline">
          ← Back to Genie
        </Link>
      </header>

      <section className="max-w-md mx-auto w-full">
        {!loaded && (
          <p className="text-sm text-gray-500">Loading your spots…</p>
        )}

        {loaded && !hasAny && (
          <div className="text-center text-sm text-gray-500 mt-8">
            <p>You haven&apos;t saved any spots yet.</p>
            <p className="mt-2">
              Ask Genie for a vibe, then tap{" "}
              <span className="font-medium">Save this spot</span> on a venue.
            </p>
          </div>
        )}

        {hasAny && (
          <div className="space-y-4">
            {savedVenues.map((venue) => (
              <Link
                key={venue.id}
                href={`/venue/${venue.id}`}
                className="block rounded-3xl border border-gray-100 shadow-sm overflow-hidden bg-white hover:shadow-md transition"
              >
                <div className="flex">
                  {/* Image */}
                  <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100">
                    <Image
                      src={venue.image}
                      alt={venue.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-4 py-3">
                    <h2 className="text-sm font-semibold text-gray-900 mb-1">
                      {venue.name}
                    </h2>
                    <p className="text-xs text-gray-500 mb-1">
                      {venue.address}
                    </p>
                    <p className="text-xs text-red-500 font-medium">
                      {venue.vibe}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
