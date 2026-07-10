"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type GenieVenue } from "@/app/lib/genieTypes";
import { galleryFor } from "@/app/lib/image";
import ImageGallery from "@/app/components/ImageGallery";
import {
  buildVenueTags,
  getGenieTake,
  getOpenUntil,
} from "@/app/components/single-page/ui";
import { readAuthToken } from "@/app/lib/localState";
import { checkInToVenue, checkOutOfVenue, fetchVenueCheckins } from "@/app/lib/publicApiClient";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          viewBox="0 0 24 24"
          className="h-[13px] w-[13px]"
          fill={star <= filled ? "#FBBF24" : "none"}
          stroke="#FBBF24"
          strokeWidth="1.5"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VenueDetailClient({ venue }: { venue: GenieVenue }) {
  const router = useRouter();

  // globals.css sets body { overflow: hidden; height: 100dvh } for
  // SinglePageGenieApp. Undo that so this standalone page scrolls normally.
  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);

  // ── Check-in state ──────────────────────────────────────────────────────
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [activeCheckins, setActiveCheckins] = useState<number | null>(null);
  const [checkinBusy, setCheckinBusy] = useState(false);

  useEffect(() => {
    if (!readAuthToken()) return;
    let cancelled = false;
    void fetchVenueCheckins(Number(venue.id))
      .then((result) => {
        if (cancelled) return;
        setActiveCheckins(result.active_checkins ?? 0);
        setIsCheckedIn(result.user_is_checked_in ?? false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [venue.id]);

  const handleToggleCheckin = useCallback(async () => {
    if (checkinBusy) return;
    if (!readAuthToken()) {
      router.push(`/?screen=login&redirect=/venue/${venue.id}`);
      return;
    }

    const venueId = Number(venue.id);
    setCheckinBusy(true);
    try {
      if (isCheckedIn) {
        await checkOutOfVenue(venueId);
        setIsCheckedIn(false);
        setActiveCheckins((prev) => (prev != null ? Math.max(0, prev - 1) : prev));
      } else {
        const result = await checkInToVenue(venueId);
        setIsCheckedIn(true);
        if (!result.already_checked_in) {
          setActiveCheckins((prev) => (prev != null ? prev + 1 : prev));
        }
      }
    } catch {
      // Leave state as-is — a failed toggle isn't worth an error banner here.
    } finally {
      setCheckinBusy(false);
    }
  }, [checkinBusy, isCheckedIn, router, venue.id]);

  const lat = venue.latitude;
  const lng = venue.longitude;
  const hasCoords = lat !== null && lng !== null;

  const raw = venue as unknown as Record<string, unknown>;
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : null;
  const reservationUrl =
    typeof raw.reservation_url === "string" ? raw.reservation_url.trim() : null;
  const isOfficialVendor = Boolean(raw.is_official_vendor);

  const openUntil = getOpenUntil(venue);
  const isOpenNow = venue.is_open_now ?? venue.hours_json?.open_now ?? null;
  const statusLabel =
    openUntil ?? (isOpenNow ? "Open now" : isOpenNow === false ? "Closed" : null);

  const tags = buildVenueTags(venue);
  const genieTake = getGenieTake(venue);
  const neighborhood =
    venue.area_neighborhood ||
    (raw.neighborhood_text as string | undefined) ||
    venue.city;

  const uberUrl = hasCoords
    ? `uber://?dropoff[lat]=${lat}&dropoff[lng]=${lng}&dropoff[nickname]=${encodeURIComponent(venue.venue_name)}`
    : null;

  const mapsUrl = venue.google_maps_url
    ? venue.google_maps_url
    : hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address ?? venue.venue_name)}`;

  const mapEmbedSrc = hasCoords
    ? `https://www.google.com/maps?q=${lat},${lng}&output=embed`
    : `https://www.google.com/maps?q=${encodeURIComponent(venue.address ?? venue.venue_name)}&output=embed`;

  const handleDirections = useCallback(() => {
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  }, [mapsUrl]);

  const handleShare = useCallback(async () => {
    const url = `https://genie.socialbevy.com/venue/${venue.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: venue.venue_name, url }); } catch { /* cancelled */ }
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => {});
  }, [venue.id, venue.venue_name]);

  const heroImage = venue.image || "/sample-venue-1.jpeg";
  // Vendor-uploaded gallery, cover first. Venues without one keep the single hero.
  const gallery = galleryFor(venue.image, venue.image_urls);

  // Ghost pill — matches the app's secondary button style
  const pillClass =
    "flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 px-3.5 py-2 text-[0.8rem] font-medium text-gray-700 shadow-sm transition hover:bg-white dark:border-white/20 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15";

  return (
    // Full-screen texture background — same as every other screen in the app
    <main className="min-h-dvh bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat dark:bg-[url('/bg.png')]">

      {/* Dark overlay — same as SinglePageGenieApp */}
      <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/50 dark:block" />

      {/* ── PHONE-FRAME COLUMN — matches SinglePageGenieApp's max-w-md container ── */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-8 pt-3">

        {/* ── BACK ARROW ──────────────────────────────────────────────── */}
        <div className="flex items-center">
          <Link
            href="/"
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center text-gray-600 dark:text-white/82"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
            </svg>
          </Link>
        </div>

        {/* ── HERO IMAGE — rounded card, same width as content ────────── */}
        <div className="relative h-56 w-full overflow-hidden rounded-[22px]">
          {gallery.length > 1 ? (
            <ImageGallery
              images={gallery}
              alt={venue.venue_name}
              heightClass="h-56"
              showThumbnails={false}
            />
          ) : (
            <Image
              src={heroImage}
              alt={venue.venue_name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 448px) 100vw, 448px"
            />
          )}
          {/* Bottom gradient for name legibility. pointer-events-none so it does
              not swallow the gallery's arrow taps. */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,0,0,0.72)_100%)]" />

          {/* Venue name overlaid at bottom */}
          <div className="absolute inset-x-0 bottom-0 px-4 pb-3.5">
            <h1 className="text-[1.55rem] font-bold leading-tight text-white drop-shadow">
              {venue.venue_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {statusLabel ? (
                <span className="text-[0.78rem] font-medium text-white/80">{statusLabel}</span>
              ) : null}
              {isOfficialVendor ? (
                <span className="rounded-full border border-white/30 bg-black/40 px-2 py-0.5 text-[0.68rem] font-medium text-white/90 backdrop-blur-sm">
                  Official Vendor
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── RATING + TAGS ───────────────────────────────────────────── */}
        <div className="rounded-[20px] border border-gray-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm">
          {venue.google_rating ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StarRating rating={venue.google_rating} />
              <span className="text-[0.85rem] font-semibold text-gray-800 dark:text-white">
                {venue.google_rating.toFixed(1)}
              </span>
              {venue.google_user_ratings_total ? (
                <span className="text-[0.8rem] text-gray-500 dark:text-white/55">
                  ({venue.google_user_ratings_total.toLocaleString()} Reviews)
                </span>
              ) : null}
              {neighborhood ? (
                <span className="text-[0.8rem] text-gray-500 dark:text-white/55">
                  · {neighborhood}
                </span>
              ) : null}
            </div>
          ) : neighborhood ? (
            <p className="text-[0.82rem] text-gray-500 dark:text-white/55">{neighborhood}</p>
          ) : null}

          {tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[0.72rem] font-medium text-red-600 dark:border-white/10 dark:bg-black/20 dark:text-white/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* ── ACTION PILLS ────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={checkinBusy}
            onClick={() => void handleToggleCheckin()}
            className={
              isCheckedIn
                ? "flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-2 text-[0.8rem] font-semibold text-white shadow-sm transition disabled:pointer-events-none disabled:opacity-60 dark:bg-white dark:text-gray-900"
                : `${pillClass} disabled:pointer-events-none disabled:opacity-60`
            }
          >
            <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            {isCheckedIn ? "Checked In" : "Check In"}
            {activeCheckins != null && activeCheckins > 0 ? (
              <span className="opacity-70">· {activeCheckins} here</span>
            ) : null}
          </button>

          {phone ? (
            <a href={`tel:${phone}`} className={pillClass}>
              <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.362 1.902.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.9a2 2 0 0 1 2.11-.45c.908.338 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z" />
              </svg>
              Call
            </a>
          ) : null}

          {uberUrl ? (
            <a href={uberUrl} className={pillClass}>
              <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="2" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              Get a Ride
            </a>
          ) : null}

          <button type="button" onClick={handleDirections} className={pillClass}>
            <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            Directions
          </button>

          {reservationUrl ? (
            <a href={reservationUrl} target="_blank" rel="noopener noreferrer" className={pillClass}>
              <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              Reservations
            </a>
          ) : null}

          <button type="button" onClick={() => void handleShare()} className={pillClass}>
            <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
              <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
            </svg>
            Share
          </button>
        </div>

        {/* ── GENIE'S TAKE ────────────────────────────────────────────── */}
        <div className="rounded-[20px] border border-gray-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm">
          <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
            Genie&apos;s Take
          </p>
          <p className="text-[0.88rem] leading-6 text-gray-700 dark:text-white/75">
            {genieTake}
          </p>
        </div>

        {/* ── MAP + ADDRESS ────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-[20px] border border-gray-100 bg-white/90 shadow-sm dark:border-white/10 dark:bg-black/25">
          <iframe
            src={mapEmbedSrc}
            width="100%"
            height="180"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Map of ${venue.venue_name}`}
          />
          {venue.address ? (
            <div className="px-4 py-3">
              <p className="text-[0.86rem] font-medium text-gray-800 dark:text-white/85">
                {venue.address}
              </p>
            </div>
          ) : null}
        </div>

        {/* ── PRIMARY CTA — exact ActionButton primary variant ─────────── */}
        <a
          href={`/?ref=venue-${venue.id}`}
          className="block w-full rounded-[18px] border border-red-500 bg-red-600 px-4 py-3.5 text-center text-[0.9rem] font-semibold text-white shadow-sm transition hover:bg-red-700 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))] dark:shadow-[0_0_0_1px_rgba(255,120,120,0.08),0_18px_36px_rgba(0,0,0,0.28)]"
        >
          Explore More in Genie
        </a>

        {venue.website_url ? (
          <a
            href={venue.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block pb-2 text-center text-[0.78rem] text-gray-400 hover:text-gray-600 dark:text-white/35 dark:hover:text-white/55"
          >
            {venue.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        ) : null}

      </div>
    </main>
  );
}
