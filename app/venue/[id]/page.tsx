"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { fetchGenieVenues, type GenieVenue } from "../../lib/genieClient";

type VenuePageProps = {
  params: Promise<{ id: string }>;
};

const STORAGE_KEY = "genie_saved_venues_v1";

// Safely select which image to use for a venue
function selectVenueImage(venue: GenieVenue | any): string {
  const primary = (venue as any).image_primary_url;
  const fallback = (venue as any).image_fallback_url;
  const generic = (venue as any).image || (venue as any).image_url;

  const candidate = primary || fallback || generic;

  // Only use it if it looks like a real image URL
  if (
    typeof candidate === "string" &&
    candidate.startsWith("http") &&
    (candidate.endsWith(".jpg") ||
      candidate.endsWith(".jpeg") ||
      candidate.endsWith(".png") ||
      candidate.endsWith(".webp"))
  ) {
    return candidate;
  }

  // Fallback to your local sample image
  return "/sample-venue-1.jpeg";
}

export default function VenuePage({ params }: VenuePageProps) {
  const [id, setId] = useState<string | null>(null);
  const [venue, setVenue] = useState<GenieVenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const router = useRouter();

  // Unwrap the params Promise (React 19)
  useEffect(() => {
    let cancelled = false;

    params.then((p) => {
      if (!cancelled) setId(p.id);
    });

    return () => {
      cancelled = true;
    };
  }, [params]);

  // Load venue + saved state
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const list = await fetchGenieVenues({
          limit: 200,
          energy_level_filter: "",
          music_filter: "",
          crowd_filter: "",
        });

        const found =
          list.find((v) => String(v.id) === String(id)) ?? null;
        setVenue(found);

        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          const ids: string[] = raw ? JSON.parse(raw) : [];
          setIsSaved(ids.includes(String(id)));
        }
      } catch (err) {
        console.error("Failed to load venue detail:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  // ---- Save / unsave spot ----
 const handleSaveSpot = () => {
  if (!venue || typeof window === "undefined") return;

  const vid = String(venue.id);
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const ids: string[] = raw ? JSON.parse(raw) : [];
  let next: string[];

  if (ids.includes(vid)) {
    // If it’s already saved, remove it
    next = ids.filter((x) => x !== vid);
    setIsSaved(false);
  } else {
    // If not saved yet, add it
    next = [...ids, vid];
    setIsSaved(true);
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  console.log("[DETAIL] Updated saved IDs:", next);
};

  // ---- Share spot ----
  const handleShare = async () => {
    if (typeof window === "undefined" || !venue) return;

    const title = venue.venue_name || (venue as any).name || "Genie spot";
    const url = window.location.href;
    const shareText = `Genie thinks you’d like ${title}.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText,
          url,
        });
      } catch {
        // user cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
        alert("Link copied. Share this vibe with your people.");
      } catch {
        alert("Couldn’t share automatically, but you can copy the URL.");
      }
    }
  };

  // ---------- Loading / error states ----------

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500">
          Genie is pulling up this spot…
        </p>
      </main>
    );
  }

  if (!venue) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <p className="text-sm text-gray-500 mb-4">
          Genie couldn&apos;t find that spot.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm font-medium text-red-500 underline"
        >
          ← Back to Genie
        </button>
      </main>
    );
  }

    // ---------- Field mapping from GenieVenue ----------

  // Title: always prefer Xano's venue_name
  const title =
    venue.venue_name || (venue as any).name || "Genie spot";

  // Address line: if we have a full address, use it; otherwise neighborhood · city
  const address =
    (venue as any).address &&
    (venue as any).address.trim().length > 0
      ? (venue as any).address
      : [venue.area_neighborhood, venue.city].filter(Boolean).join(" · ");

  // Vibe line: energy • music • crowd
  const vibeLine = [
    venue.energy_level,
    venue.music,
    venue.crowd,
  ]
    .filter((part) => !!part && String(part).trim().length > 0)
    .join(" • ");

  // Description: use vibe_notes as the primary description
  const description =
    (venue as any).vibe_notes ||
    (venue as any).description ||
    "";

  // Best time to go (your Xano field)
  const bestTime =
    (venue as any).best_time_to_go || "";

// Image: pick the best available URL or fallback
const imageSrc = selectVenueImage(venue);


  // ---------- Render full detail card ----------

  return (
    <main className="min-h-screen flex flex-col items-center pt-8 px-4 pb-16 bg-white">
      {/* Back link centered */}
      <div className="w-full flex justify-center mb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm font-medium text-red-500"
        >
          ← Back to Genie
        </button>
      </div>

      <section className="w-full max-w-md">
        {/* Card */}
        <div className="relative bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Image wrapper */}
         {/* Image wrapper */}
<div className="relative w-full h-64">
  <Image
    src={imageSrc}
    alt={title || "Venue photo"}
    fill
    className="object-cover"
    priority
  />
</div>

          {/* Share icon */}
          <button
            type="button"
            onClick={handleShare}
            className="absolute right-4 top-4 z-20 rounded-full bg-white/90 shadow p-2"
            aria-label="Share this spot"
          >
            <Image
              src="/share-icon.png"
              alt="Share"
              width={18}
              height={18}
              className="object-contain"
            />
          </button>

          {/* Text content */}
          <div className="px-5 py-4">
  <h1 className="text-2xl font-semibold text-gray-900 mb-1">
    {title}
  </h1>

  {address && (
    <p className="text-sm text-gray-500 mb-2">{address}</p>
  )}

  {vibeLine && (
    <p className="text-sm font-medium text-red-500 mb-2">
      {vibeLine}
    </p>
  )}

  {description && (
    <p className="text-sm text-gray-700 mb-3">{description}</p>
  )}

  {bestTime && (
    <p className="text-xs text-gray-500">
      Best time to go: {bestTime}
    </p>
  )}
</div>

        </div>

        {/* Save button */}
        <button
  type="button"
  onClick={handleSaveSpot}
  className="mt-5 w-full py-4 rounded-full bg-red-500 text-white font-semibold text-center shadow-md"
>
  {isSaved ? "Saved" : "Save this spot"}
</button>
      </section>
    </main>
  );
}
