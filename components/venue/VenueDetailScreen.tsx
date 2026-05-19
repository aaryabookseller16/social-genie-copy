"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import HamburgerMenu from "@/components/nav/HamburgerMenu";
import { googleMapsOpenUrl, googleStaticMapUrl } from "@/app/lib/maps";

type ResultVenue = {
  id: string | number;
  venue_name: string;
  area_neighborhood?: string | null;
  address?: string | null;
  vibe_notes?: string | null;
  image?: string | null;
  website_url?: string | null;
  instagram_handle?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function starsFromRating(rating: number) {
  const r = clamp(rating, 0, 5);
  const full = Math.floor(r);
  const half = r - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return { full, half, empty };
}

function normalizeChips(vibeNotes?: string | null) {
  const raw = (vibeNotes || "").trim();
  if (!raw) return [];
  return raw
    .split(/[·,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function isRemoteUrl(src: string) {
  return /^https?:\/\//i.test(src);
}

export default function VenueDetailScreen({ venue }: { venue: ResultVenue }) {
  const router = useRouter();

  // Phase-1 placeholders (until Xano provides these fields)
  const rating = 4.6;
  const reviewCount = 682;
  const distanceMiles = 2.2;
  const openUntilText = "Open Until 2 AM";
  const isOfficialVendor = true;

  const chips = useMemo(
    () => normalizeChips(venue.vibe_notes),
    [venue.vibe_notes]
  );

  // ✅ Canonical hero image (no field drift)
const heroImage = useMemo(() => {
  if (venue?.image_primary_url?.trim()) {
    return venue.image_primary_url;
  }

  if (venue?.image_fallback_url?.trim()) {
    return venue.image_fallback_url;
  }

  return "/placeholder-venue.png";
}, [venue?.image_primary_url, venue?.image_fallback_url]);

  const heroIsRemote = useMemo(() => isRemoteUrl(heroImage), [heroImage]);

  // Maps helpers (address-only Phase 1)
  const mapsOpenUrl = useMemo(
    () => googleMapsOpenUrl(venue.address),
    [venue.address]
  );

  const directionsUrl = useMemo(() => {
    const q = (venue.address || "").trim();
    if (!q) return "https://www.google.com/maps";
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      q
    )}&travelmode=driving`;
  }, [venue.address]);

  // Static map URL (may be null if key missing / address empty)
  const staticSrc = useMemo(
    () => googleStaticMapUrl(venue.address),
    [venue.address]
  );

  const stars = useMemo(() => starsFromRating(rating), [rating]);

  const instagramUrl = useMemo(() => {
    const h = (venue.instagram_handle || "").trim().replace(/^@/, "");
    return h ? `https://instagram.com/${h}` : null;
  }, [venue.instagram_handle]);

  const websiteUrl = useMemo(() => {
    const u = (venue.website_url || "").trim();
    return u ? u : null;
  }, [venue.website_url]);

  return (
    <main className="min-h-screen relative overflow-hidden bg-zinc-50 dark:bg-black">
      {/* Background glow / texture */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[760px] rounded-full blur-3xl bg-red-500/20 dark:bg-red-600/25" />
        <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.10] bg-[radial-gradient(circle_at_20%_20%,#ef4444,transparent_45%),radial-gradient(circle_at_80%_30%,#ef4444,transparent_40%),radial-gradient(circle_at_50%_80%,#ef4444,transparent_45%)]" />
      </div>

      {/* Top nav (logo left, hamburger right) */}
      <div className="relative z-20 mx-auto w-full max-w-6xl px-6 pt-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-3"
            aria-label="Go home"
          >
            <div className="relative h-9 w-9">
              <Image
                src="/sb-logo-icon.png"
                alt="Social Bevy"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="hidden md:inline text-zinc-800 dark:text-zinc-100 font-medium tracking-tight">
              social bevy
            </span>
          </button>

          <div className="flex items-center gap-3">
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

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-12 pt-6">
        {/* Breadcrumb / back row */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200"
          >
            <span className="text-2xl leading-none">←</span>
            <span className="text-[18px] md:text-[20px] font-medium">
              Results / Nightlife / {venue.area_neighborhood || "Area"}
            </span>
          </button>

          {/* Need help + Genie (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <span className="text-zinc-500 dark:text-zinc-400">Need help?</span>
            <div className="relative w-[76px] h-[76px] rounded-3xl overflow-hidden border border-white/50 dark:border-white/10 shadow-sm bg-white/40">
              <Image
                src="/genie-pic2.png"
                alt="Genie"
                fill
                className="object-cover"
                style={{ objectPosition: "50% 18%" }}
                priority
              />
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT: Hero + About + Chips */}
          <section className="rounded-[28px] md:rounded-[32px] border border-white/40 dark:border-white/10 bg-white/55 dark:bg-white/10 backdrop-blur-md shadow-sm overflow-hidden">
            <div className="relative w-full h-[260px] md:h-[300px]">
              {heroIsRemote ? (
                <img
                  src={heroImage}
                  alt={venue.venue_name}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Image
                  src={heroImage}
                  alt={venue.venue_name}
                  fill
                  className="object-cover"
                  priority
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
            </div>

            <div className="p-6">
              <h3 className="text-[26px] md:text-[28px] font-semibold text-zinc-900 dark:text-zinc-100">
                About
              </h3>

              <p className="mt-3 text-[16px] md:text-[17px] leading-relaxed text-zinc-700 dark:text-zinc-200 whitespace-pre-line">
                {venue.vibe_notes?.trim()
                  ? `A great match for your vibe.\n\n${venue.vibe_notes}`
                  : "A great spot with a lively vibe, good music, and a strong social scene. Dress code may apply."}
              </p>

              {chips.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {chips.map((t, idx) => (
                    <span
                      key={`${t}-${idx}`}
                      className="px-4 py-2 rounded-full text-[14px] bg-black/5 dark:bg-white/10 text-zinc-700 dark:text-zinc-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT: Title/meta + actions + map */}
          <section className="rounded-[28px] md:rounded-[32px] border border-white/40 dark:border-white/10 bg-white/55 dark:bg-white/10 backdrop-blur-md shadow-sm p-6">
            <h1 className="text-[34px] md:text-[40px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {venue.venue_name}
            </h1>

            {/* Rating row */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-zinc-700 dark:text-zinc-200">
              <div className="flex items-center gap-1">
                {Array.from({ length: stars.full }).map((_, i) => (
                  <span key={`f-${i}`}>⭐</span>
                ))}
                {Array.from({ length: stars.half }).map((_, i) => (
                  <span key={`h-${i}`}>⭐</span>
                ))}
                {Array.from({ length: stars.empty }).map((_, i) => (
                  <span key={`e-${i}`} className="opacity-30">
                    ⭐
                  </span>
                ))}
              </div>

              <span className="font-medium">{rating.toFixed(1)}</span>
              <span className="text-zinc-500 dark:text-zinc-400">
                ({reviewCount} reviews)
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                • {distanceMiles.toFixed(1)} mi
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                | {venue.area_neighborhood || "Area"}
              </span>
            </div>

            {/* Open/vendor row */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[18px] text-zinc-700 dark:text-zinc-200">
              <span>{openUntilText}</span>
              {isOfficialVendor && (
                <span className="inline-flex items-center gap-2">
                  <span className="text-red-600">📌</span>
                  <span className="text-zinc-800 dark:text-zinc-100 font-medium">
                    Official Vendor
                  </span>
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={websiteUrl ?? "#"}
                target={websiteUrl ? "_blank" : undefined}
                rel={websiteUrl ? "noreferrer" : undefined}
                className={[
                  "inline-flex items-center gap-2 px-5 py-3 rounded-full border shadow-sm",
                  "bg-red-50/70 dark:bg-white/10 backdrop-blur",
                  "border-red-200/60 dark:border-white/10",
                  websiteUrl
                    ? "hover:shadow-md"
                    : "opacity-50 cursor-not-allowed",
                ].join(" ")}
              >
                🌐 <span className="font-medium">Website</span>
              </a>

              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full border shadow-sm bg-red-50/70 dark:bg-white/10 backdrop-blur border-red-200/60 dark:border-white/10 hover:shadow-md"
              >
                📍 <span className="font-medium">Directions</span>
              </a>

              <a
                href={instagramUrl ?? "#"}
                target={instagramUrl ? "_blank" : undefined}
                rel={instagramUrl ? "noreferrer" : undefined}
                className={[
                  "inline-flex items-center gap-2 px-5 py-3 rounded-full border shadow-sm",
                  "bg-red-50/70 dark:bg-white/10 backdrop-blur",
                  "border-red-200/60 dark:border-white/10",
                  instagramUrl
                    ? "hover:shadow-md"
                    : "opacity-50 cursor-not-allowed",
                ].join(" ")}
              >
                📸 <span className="font-medium">Instagram</span>
              </a>
            </div>

            {/* Map card */}
            <div className="mt-6 rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-white/10 overflow-hidden shadow-sm">
              <a
                href={mapsOpenUrl}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <div className="relative h-[220px] w-full">
                  {staticSrc ? (
                    <img
                      src={staticSrc}
                      alt={`Map preview for ${venue.venue_name}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-200/40 dark:bg-white/5">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">
                        Map preview unavailable
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />
                  <div className="absolute left-4 bottom-4 text-white/90 text-sm">
                    Google
                  </div>
                </div>
              </a>

              <div className="p-5">
                <div className="text-[20px] font-medium text-zinc-900 dark:text-zinc-100">
                  {venue.address || "Address not available"}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={mapsOpenUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-200/60 dark:border-white/10 bg-white/60 dark:bg-white/10 backdrop-blur text-zinc-800 dark:text-zinc-100"
                  >
                    <span>Open in Google Maps</span>
                    <span>↗</span>
                  </a>

                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-200/60 dark:border-white/10 bg-white/60 dark:bg-white/10 backdrop-blur text-zinc-800 dark:text-zinc-100"
                  >
                    <span>Directions</span>
                    <span>↗</span>
                  </a>
                </div>

                <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Map is clickable
                </div>
              </div>
            </div>

            {/* Mobile “Need help?” */}
            <div className="md:hidden mt-6 flex items-center justify-between rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-white/10 p-4">
              <div className="text-zinc-700 dark:text-zinc-200 font-medium">
                Need help?
              </div>
              <div className="relative w-[58px] h-[58px] rounded-2xl overflow-hidden border border-white/50 dark:border-white/10 shadow-sm bg-white/40">
                <Image
                  src="/genie-pic2.png"
                  alt="Genie"
                  fill
                  className="object-cover"
                  style={{ objectPosition: "50% 18%" }}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
