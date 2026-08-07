"use client";
 
/**
 * /app/events/[slug]/EventDetailClient.tsx
 *
 * CLIENT COMPONENT — Event Detail Screen
 *
 * Handles:
 *   - All interactive CTAs (tickets, ride, reservation, directions, save, share)
 *   - External click attribution logging (ep_log_external_click_dev)
 *   - Social proof section (Going / Interested counts)
 *   - V.I.Bee offer teaser for non-members
 *   - Post-event survey prompt trigger
 *   - Acquisition CTA for unauthenticated visitors
 *
 * Architecture note:
 *   This is intentionally a standalone page, NOT a screen inside
 *   SinglePageGenieApp. Event detail lives at a real URL
 *   (socialbevy.com/events/{slug}) so it can be shared externally,
 *   indexed by search engines, and opened from push notifications.
 *
 *   The Genie app's internal event-detail screen (FlowAnchor = "event-detail")
 *   will be a lightweight wrapper that deep-links here OR renders inline
 *   using the same data shape.
 */
 
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { fetchEventDetail } from "@/app/lib/publicApiClient";
import { readAuthToken } from "@/app/lib/localState";
import { useEventRsvp, type UserRsvpStatus } from "@/app/lib/useEventRsvp";
import ImageGallery from "@/app/components/ImageGallery";
import { mediaGalleryFor } from "@/app/lib/image";
import FeaturedEventVideos from "@/app/components/FeaturedEventVideos";
import { openUberRide } from "@/app/lib/uber";
 
// ─── Types (mirror server types) ─────────────────────────────────────────────
 
interface EventVenue {
  id: number;
  venue_name: string;
  address?: string;
  city?: string;
  neighborhood_text?: string;
  area_neighborhood?: string;
  latitude?: number;
  longitude?: number;
  google_rating?: number;
  google_user_ratings_total?: number;
  social_energy_score?: number;
  social_energy_state?: string;
  is_open_now?: boolean;
  opentable_url?: string;
  reservation_provider?: string;
  uber_deeplink?: string;
  image_primary_url?: string;
  image_fallback_url?: string;
  vendor_status?: string;
  vendor_status_message?: string;
}
 
interface TicketCTA {
  label: string;
  url: string | null;
  price_min?: number | null;
  price_max?: number | null;
  provider?: string;
  is_sold_out: boolean;
}
 
interface TransactionCTA {
  label: string;
  url: string;
  provider?: string;
}
 
interface SocialEvent {
  id: number;
  title: string;
  description?: string;
  event_date?: string;
  event_start_time?: string;
  event_end_time?: string;
  event_category?: string;
  cover_image_url?: string;
  image_urls?: string[];
  /** Separate from image_urls; combined count is capped at 5 by Xano. */
  video_urls?: { url: string; thumbnail_url: string }[];
  public_slug: string;
  status: string;
  rsvp_count?: number;
  going_count?: number;
  interested_count?: number;
  user_rsvp_status?: "going" | "interested" | "saved" | null;
  view_count?: number;
  is_free?: boolean;
  is_sold_out?: boolean;
  ticket_url?: string;
  ticket_provider?: string;
  ticket_price_min?: number;
  ticket_price_max?: number;
  age_requirement?: number;
}
 
interface EventDetailResponse {
  success: boolean;
  event: SocialEvent;
  venue: EventVenue | null;
  offers: unknown[];
  influencer_offers: unknown[];
  ticket_cta: TicketCTA | null;
  ride_cta: TransactionCTA | null;
  reservation_cta: TransactionCTA | null;
  public_url: string;
}
 
interface EventDetailClientProps {
  data: EventDetailResponse;
  relatedEvents: SocialEvent[];
  slug: string;
}
 
// ─── External click attribution ──────────────────────────────────────────────
 
type ClickType =
  | "tickets"
  | "reservation"
  | "ride"
  | "directions"
  | "share"
  | "hotel"
  | "flight";
 
async function logExternalClick(
  eventId: number,
  clickType: ClickType,
  destinationUrl: string
) {
  // Fire and forget — never block the user's tap
  try {
    await fetch("/api/genie/track-signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signal_type: "external_click",
        signal_value: clickType,
        event_id: eventId,
        destination_url: destinationUrl,
      }),
    });
  } catch {
    // Silent fail — attribution is non-blocking
  }
}
 
// ─── Helper: format event date ────────────────────────────────────────────────
 
function formatEventDate(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const dateFormatted = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return timeStr ? `${dateFormatted} · ${timeStr}` : dateFormatted;
  } catch {
    return dateStr;
  }
}
 
// ─── Helper: social energy badge color ────────────────────────────────────────
 
function getSocialEnergyColor(score?: number): string {
  if (!score) return "bg-gray-400";
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-gray-400";
}
 
// ─── Component ───────────────────────────────────────────────────────────────
 
export function EventDetailClient({
  data,
  relatedEvents,
  slug,
}: EventDetailClientProps) {
  const { event, venue, ticket_cta, reservation_cta } = data;
  const router = useRouter();

  // Track whether the user has tapped "Get Tickets" (optimistic sold-out UX)
  const [ticketTapped, setTicketTapped] = useState(false);

  // This page is server-rendered with no auth context (it's a public,
  // shareable microsite), so `event.user_rsvp_status` is never populated by
  // the SSR fetch. If the visitor happens to be logged in on this device,
  // fetch the authenticated event-detail view once on mount to learn their
  // own RSVP state — same event, same endpoint the in-app screen uses.
  const [authRsvpStatus, setAuthRsvpStatus] = useState<UserRsvpStatus>(null);
  useEffect(() => {
    if (!readAuthToken()) return;
    fetchEventDetail(event.id)
      .then((d) => setAuthRsvpStatus(d.event?.user_rsvp_status ?? null))
      .catch(() => {});
  }, [event.id]);

  const rsvp = useEventRsvp(
    event.id,
    authRsvpStatus,
    event.going_count ?? 0,
    event.interested_count ?? 0,
    "event-microsite",
    () => router.push(`/?screen=login&redirect=/events/${slug}`)
  );
 
  // Share sheet
  const handleShare = useCallback(async () => {
    const url = `https://socialbevy.com/events/${slug}`;
    const text = `Check out ${event.title} on Social Bevy`;
 
    void logExternalClick(event.id, "share", url);
 
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: event.title, text, url });
      } catch {
        // User cancelled share — no-op
      }
      return;
    }
 
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    }
  }, [event.id, event.title, slug]);
 
  // Directions
  const handleDirections = useCallback(() => {
    if (!venue) return;
    const query =
      venue.address ||
      [venue.venue_name, venue.city].filter(Boolean).join(", ");
    const mapsUrl =
      venue.latitude && venue.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${venue.latitude},${venue.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
 
    void logExternalClick(event.id, "directions", mapsUrl);
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  }, [event.id, venue]);

  // Get a Ride — built from venue.latitude/longitude (the same field
  // Directions already uses above), not the old venue.uber_deeplink, which is
  // empty on every venue in the live database and left this button dead.
  // Pickup is resolved at click time via browser geolocation — this page has
  // no app-level cached location (see app/lib/uber.ts).
  const handleRide = useCallback(() => {
    if (!venue || venue.latitude == null || venue.longitude == null) return;
    void logExternalClick(event.id, "ride", `uber:${venue.venue_name}`);
    openUberRide({
      dropoff: { lat: venue.latitude, lng: venue.longitude },
      dropoffLabel: venue.venue_name,
    });
  }, [event.id, venue]);

  const heroFallback =
    event.cover_image_url ||
    venue?.image_primary_url ||
    venue?.image_fallback_url ||
    "/sample-venue-1.jpeg";

  // Photos lead, video(s) follow — one carousel a visitor can swipe/tap through.
  // Falls back to a single implicit image when the event has no cover, gallery,
  // or video at all (mediaGalleryFor returns [] in that case).
  const heroMediaRaw = mediaGalleryFor(event.cover_image_url, event.image_urls, event.video_urls);
  const heroMedia = heroMediaRaw.length > 0 ? heroMediaRaw : [{ type: "image" as const, url: heroFallback }];

  return (
    <main className="min-h-screen bg-white">

      {/* ── HERO IMAGE ─────────────────────────────────────────────────── */}
      <div className="relative h-[42vh] min-h-[260px] w-full overflow-hidden">
        <ImageGallery
          items={heroMedia}
          alt={event.title}
          className="absolute inset-0"
          heightClass="h-full"
          showThumbnails={false}
        />
        {/* Gradient overlay — pointer-events-none so it doesn't swallow the carousel's arrow taps */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.3)_0%,transparent_40%,rgba(0,0,0,0.75)_100%)]" />
 
        {/* Top nav */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4">
          <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm" aria-label="Back to Social Bevy">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
          </Link>
 
          <button type="button" onClick={handleShare} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm" aria-label="Share this event">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
            </svg>
          </button>
        </div>
 
        {/* Event title overlay */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          {event.is_free ? (
            <span className="mb-2 inline-block rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white">
              FREE EVENT
            </span>
          ) : null}
          <h1 className="text-[1.8rem] font-bold leading-tight text-white drop-shadow">
            {event.title}
          </h1>
        </div>
      </div>

      {/* ── CONTENT ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl space-y-6 px-5 pb-32 pt-5">
 
        {/* ── EVENT META ─────────────────────────────────────────────── */}
        <div className="space-y-2">
 
          {/* Date + time */}
          {event.event_date ? (
            <div className="flex items-center gap-2 text-[0.9rem] text-gray-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-red-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              <span>{formatEventDate(event.event_date, event.event_start_time)}</span>
            </div>
          ) : null}
 
          {/* Venue location */}
          {venue ? (
            <div className="flex items-center gap-2 text-[0.9rem] text-gray-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-red-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span>{venue.venue_name}{venue.area_neighborhood ? ` · ${venue.area_neighborhood}` : ""}</span>
            </div>
          ) : null}
 
          {/* Age requirement */}
          {event.age_requirement && event.age_requirement > 0 ? (
            <div className="flex items-center gap-2 text-[0.85rem] text-gray-500">
              <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <span>{event.age_requirement}+ only</span>
            </div>
          ) : null}
 
          {/* Social proof */}
          {rsvp.goingCount > 0 ? (
            <div className="flex items-center gap-2 text-[0.85rem] text-gray-500">
              <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-red-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>
                <strong className="font-semibold text-gray-900">{rsvp.goingCount}</strong> people going
              </span>
            </div>
          ) : null}
        </div>

        {/* ── GOING / INTERESTED ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={rsvp.busy}
            onClick={() => rsvp.setRsvp("going")}
            className={`rounded-[16px] border px-4 py-3 text-center text-[0.85rem] font-semibold transition disabled:pointer-events-none disabled:opacity-60 ${
              rsvp.status === "going"
                ? "border-red-600 bg-red-600 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:border-red-300"
            }`}
          >
            {rsvp.status === "going" ? "✓ Going" : "Going"}
          </button>
          <button
            type="button"
            disabled={rsvp.busy}
            onClick={() => rsvp.setRsvp("interested")}
            className={`rounded-[16px] border px-4 py-3 text-center text-[0.85rem] font-semibold transition disabled:pointer-events-none disabled:opacity-60 ${
              rsvp.status === "interested"
                ? "border-red-600 bg-red-600 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:border-red-300"
            }`}
          >
            {rsvp.status === "interested" ? "✓ Interested" : "Interested"}
          </button>
        </div>
 
        {/* ── TRANSACTION CTAs ─────────────────────────────────────────── */}
        {/*
          These are the V1.5 transaction layer deeplinks.
          Every tap logs to event_external_clicks via logExternalClick().
          This is the data foundation for the investor narrative:
          "Genie drove X ticket purchases / reservations / rides this month."
        */}
        <div className="space-y-3">
 
          {/* GET TICKETS */}
          {ticket_cta ? (
            <div>
              {ticket_cta.is_sold_out || ticketTapped ? (
                <div className="w-full rounded-[18px] border border-gray-300 bg-gray-100 px-6 py-4 text-center">
                  <p className="font-semibold text-gray-500">Sold Out</p>
                  <p className="mt-1 text-sm text-gray-400">Check back for more events at this venue</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!ticket_cta.url) return;
                    setTicketTapped(true);
                    void logExternalClick(event.id, "tickets", ticket_cta.url);
                    window.open(ticket_cta.url, "_blank", "noopener,noreferrer");
                  }}
                  className="w-full rounded-[18px] bg-red-600 px-6 py-4 text-center font-semibold text-white shadow-[0_8px_24px_rgba(220,38,38,0.35)] transition hover:bg-red-700"
                >
                  <span className="block text-[1rem]">Get Tickets</span>
                  {ticket_cta.price_min ? (
                    <span className="block text-[0.8rem] font-normal text-red-200">
                      From ${ticket_cta.price_min}
                      {ticket_cta.price_max && ticket_cta.price_max !== ticket_cta.price_min
                        ? ` – $${ticket_cta.price_max}`
                        : ""}
                    </span>
                  ) : null}
                </button>
              )}
            </div>
          ) : null}
 
          {/* SECONDARY CTAs: Ride + Reservation + Directions */}
          <div className="grid grid-cols-3 gap-2">
 
            {/* Get a Ride */}
            {venue ? (
              <button
                type="button"
                onClick={handleRide}
                className="flex flex-col items-center gap-1.5 rounded-[16px] border border-gray-200 bg-white px-2 py-3 text-center shadow-sm transition hover:border-red-300"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5" />
                  <circle cx="18" cy="17" r="2" /><circle cx="8" cy="17" r="2" />
                  <path d="M16 17H10" />
                </svg>
                <span className="text-[0.72rem] font-semibold text-gray-700">Get a Ride</span>
              </button>
            ) : null}
 
            {/* Reserve a Table */}
            {reservation_cta ? (
              <button
                type="button"
                onClick={() => {
                  void logExternalClick(event.id, "reservation", reservation_cta.url);
                  window.open(reservation_cta.url, "_blank", "noopener,noreferrer");
                }}
                className="flex flex-col items-center gap-1.5 rounded-[16px] border border-gray-200 bg-white px-2 py-3 text-center shadow-sm transition hover:border-red-300"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                <span className="text-[0.72rem] font-semibold text-gray-700">Reserve</span>
              </button>
            ) : null}
 
            {/* Directions */}
            {venue ? (
              <button
                type="button"
                onClick={handleDirections}
                className="flex flex-col items-center gap-1.5 rounded-[16px] border border-gray-200 bg-white px-2 py-3 text-center shadow-sm transition hover:border-red-300"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                <span className="text-[0.72rem] font-semibold text-gray-700">Directions</span>
              </button>
            ) : null}
          </div>
        </div>
 
        {/* ── DESCRIPTION ──────────────────────────────────────────────── */}
        {event.description ? (
          <div>
            <h2 className="mb-2 text-[1.05rem] font-semibold text-gray-900">About this event</h2>
            <p className="text-[0.9rem] leading-6 text-gray-600">{event.description}</p>
          </div>
        ) : null}

        {/* ── FEATURED VIDEOS ───────────────────────────────────────────── */}
        <FeaturedEventVideos
          videos={event.video_urls}
          eventTitle={event.title}
          headingClassName="text-gray-900"
        />

        {/* ── EMBEDDED VENUE CARD ───────────────────────────────────────── */}
        {/*
          Surfaces the linked venue inline — no extra tap required.
          Shows: name, Social Energy badge, neighborhood, rating, hours.
          "View full venue" routes to /venue/{id} (existing page).
        */}
        {venue ? (
          <div className="rounded-[20px] border border-gray-100 bg-gray-50 p-4 shadow-sm">
            <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-gray-400">
              Venue
            </p>
 
            <div className="flex items-start gap-3">
              {/* Venue thumbnail */}
              <div className="relative h-16 w-16 flex-none overflow-hidden rounded-[12px]">
                <Image
                  src={venue.image_primary_url || venue.image_fallback_url || "/sample-venue-1.jpeg"}
                  alt={venue.venue_name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
 
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-gray-900">{venue.venue_name}</h3>
                  {/* Social Energy badge */}
                  {venue.social_energy_score ? (
                    <span className={`flex-none rounded-full px-2 py-0.5 text-[0.65rem] font-bold text-white ${getSocialEnergyColor(venue.social_energy_score)}`}>
                      {venue.social_energy_state || "Active"}
                    </span>
                  ) : null}
                </div>
 
                {venue.area_neighborhood || venue.neighborhood_text ? (
                  <p className="mt-0.5 text-[0.78rem] text-gray-500">
                    {venue.area_neighborhood || venue.neighborhood_text}
                  </p>
                ) : null}
 
                {venue.google_rating ? (
                  <div className="mt-1 flex items-center gap-1 text-[0.78rem]">
                    <span className="text-yellow-400">★</span>
                    <span className="font-medium text-gray-700">{venue.google_rating.toFixed(1)}</span>
                    {venue.google_user_ratings_total ? (
                      <span className="text-gray-400">({venue.google_user_ratings_total.toLocaleString()})</span>
                    ) : null}
                  </div>
                ) : null}
 
                {/* Vendor status — shows if not operating_normally */}
                {venue.vendor_status && venue.vendor_status !== "operating_normally" ? (
                  <p className="mt-1 text-[0.72rem] font-medium text-amber-600">
                    {venue.vendor_status_message || venue.vendor_status.replace(/_/g, " ")}
                  </p>
                ) : null}
              </div>
            </div>
 
            <div className="mt-3 flex items-center justify-between">
              <span className={`text-[0.78rem] font-medium ${venue.is_open_now ? "text-green-600" : "text-gray-400"}`}>
                {venue.is_open_now ? "Open now" : "Closed"}
              </span>
              <a href={`/venue/${venue.id}`} className="text-[0.78rem] font-semibold text-red-600 hover:underline">
                View full venue
              </a>
            </div>
          </div>
        ) : null}
 
        {/* ── V.I.BEE OFFER SECTION ─────────────────────────────────────── */}
        {/*
          For V.I.Bee members: offer displayed + redeem CTA
          For non-members: offer teased with upgrade prompt
          This is the highest-intent V.I.Bee upgrade moment on the platform.
        */}
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <p className="text-[0.82rem] font-semibold text-amber-700">V.I.Bee Members Only</p>
          </div>
          <p className="text-[0.85rem] text-amber-800">
            V.I.Bee members get exclusive offers at this event and venue.
          </p>
          <a href="https://genie.socialbevy.com?screen=membership" className="mt-3 block w-full rounded-[14px] bg-amber-500 py-3 text-center text-sm font-semibold text-white hover:bg-amber-600">
            Upgrade for $2.99/month
          </a>
        </div>
 
        {/* ── ACQUISITION CTA ───────────────────────────────────────────── */}
        {/*
          Every external visit is an acquisition opportunity.
          This CTA is the primary conversion point for anonymous visitors.
          Deep-link carries slug so they land back on this event post-signup.
        */}
        <div className="rounded-[20px] bg-gray-900 p-5 text-center">
          <Image
            src="/icons/Social-Genie-Home-Screen.png"
            alt="Genie"
            width={64}
            height={64}
            className="mx-auto mb-3 h-16 w-16 object-contain"
          />
          <h3 className="text-[1.1rem] font-bold text-white">
            Discover more events like this
          </h3>
          <p className="mt-1 text-[0.82rem] text-white/65">
            Genie finds the best experiences in Houston — tailored to your vibe.
          </p>
          <a href={`https://genie.socialbevy.com?ref=event-${slug}`} className="mt-4 block w-full rounded-[16px] bg-red-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700">
            Try Genie Free
          </a>
        </div>
 
        {/* ── RELATED EVENTS ───────────────────────────────────────────── */}
        {relatedEvents.length > 0 ? (
          <div>
            <h2 className="mb-3 text-[1.05rem] font-semibold text-gray-900">
              More events you might like
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {relatedEvents.slice(0, 4).map((related) => (
                <a key={related.id} href={`/events/${related.public_slug}`} className="overflow-hidden rounded-[16px] border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
                  <div className="relative h-28 w-full">
                    <Image
                      src={related.cover_image_url || "/sample-venue-2.jpeg"}
                      alt={related.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 44vw, 200px"
                    />
                    {related.is_free ? (
                      <span className="absolute left-2 top-2 rounded-full bg-green-500 px-2 py-0.5 text-[0.6rem] font-bold text-white">
                        FREE
                      </span>
                    ) : null}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="line-clamp-2 text-[0.82rem] font-semibold text-gray-900">
                      {related.title}
                    </p>
                    {related.event_date ? (
                      <p className="mt-0.5 text-[0.7rem] text-gray-400">
                        {new Date(related.event_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    ) : null}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}
 
      </div>
 
      {/* ── STICKY BOTTOM CTA ────────────────────────────────────────────── */}
      {/*
        Sticky ticket CTA visible on scroll.
        Only shown when ticket_cta exists and event is not sold out.
        Mirrors the floating CTA pattern from the in-app detail screen.
      */}
      {ticket_cta && !ticket_cta.is_sold_out && ticket_cta.url ? (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 px-4 pb-6 pt-3 backdrop-blur-sm shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-2xl">
            <button
              type="button"
              onClick={() => {
                void logExternalClick(event.id, "tickets", ticket_cta.url!);
                window.open(ticket_cta.url!, "_blank", "noopener,noreferrer");
              }}
              className="w-full rounded-[18px] bg-red-600 py-4 text-center font-semibold text-white shadow-[0_8px_24px_rgba(220,38,38,0.35)]"
            >
              {ticket_cta.price_min
                ? `Get Tickets — From $${ticket_cta.price_min}`
                : "Get Tickets"}
            </button>
          </div>
        </div>
      ) : null}

    </main>
  );
}
 