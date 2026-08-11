/**
 * /app/events/[slug]/page.tsx
 *
 * PUBLIC EVENT DETAIL PAGE
 * Route: socialbevy.com/events/{slug}
 *
 * This IS the event microsite. Same data, two contexts:
 *   - Authenticated user: full social context
 *   - Anonymous visitor: social proof visible, V.I.Bee offer teased,
 *     acquisition CTA prominent
 *
 * Data source: ep_get_event_by_slug_dev (Xano v1.5-dev)
 * External click attribution: ep_log_external_click_dev
 * Related events: ep_get_related_events_dev
 *
 * V1.5 transaction CTAs (deeplinks only — no native API contracts yet):
 *   - Get Tickets → ticket_url deeplink
 *   - Get a Ride → uber_deeplink on linked venue
 *   - Reserve a Table → opentable_url on linked venue
 *   - Get Directions → Google Maps deeplink
 *
 * Every external tap logs to event_external_clicks via
 * ep_log_external_click_dev for investor attribution narrative.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { EventDetailClient } from "@/app/events/[slug]/EventDetailClient";
import { xanoFetch } from "@/app/lib/server/xanoProxy";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  venue_id?: number;
  cover_image_url?: string;
  image_urls?: string[];
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
  created_by_type?: string;
  source?: string;
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

interface RelatedEventsResponse {
  success: boolean;
  related_events: SocialEvent[];
  count: number;
}

// ─── Server data fetching ─────────────────────────────────────────────────────

async function loadEventBySlug(slug: string): Promise<EventDetailResponse | null> {
  try {
    const response = await xanoFetch<EventDetailResponse>(
      "genie/ep_get_event_by_slug_dev",
      { params: { slug } }
    );
    if (!response.success) return null;

    // Xano's influencer-offers query doesn't actually filter by venue (known
    // backend bug), so it can return offers unrelated to this event. Filter
    // client-side until the endpoint is fixed.
    const eventVenueId = response.event?.venue_id;
    const filteredInfluencerOffers = eventVenueId
      ? response.influencer_offers.filter(
          (offer) => (offer as { venue_id?: number })?.venue_id === eventVenueId
        )
      : [];

    return { ...response, influencer_offers: filteredInfluencerOffers };
  } catch {
    return null;
  }
}

async function loadRelatedEvents(eventId: number): Promise<SocialEvent[]> {
  try {
    const response = await xanoFetch<RelatedEventsResponse>(
      "genie/ep_get_related_events_dev",
      { params: { event_id: String(eventId), limit: String(4) } }
    );
    return response.related_events ?? [];
  } catch {
    return [];
  }
}

// ─── SEO Metadata ─────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadEventBySlug(slug);

  if (!data) {
    return { title: "Event - Social Bevy" };
  }

  const { event, venue } = data;
  const title = `${event.title} - Social Bevy`;
  const description =
    event.description?.slice(0, 155) ||
    [event.title, venue?.venue_name, event.event_date]
      .filter(Boolean)
      .join(" · ");
  const image =
    event.cover_image_url ||
    venue?.image_primary_url ||
    "https://socialbevy.com/images/socialbevylogo.png";
  const url = `https://socialbevy.com/events/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Social Bevy",
      type: "website",
      images: [{ url: image, alt: event.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadEventBySlug(slug);

  // 404 fallback
  if (!data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Event not found</h1>
        <p className="mt-2 text-gray-500">
          This event may have ended or been removed.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white"
        >
          Discover events on Social Bevy
        </Link>
      </main>
    );
  }

  // Load related events in parallel (non-blocking)
  const relatedEvents = await loadRelatedEvents(data.event.id);

  return (
    <EventDetailClient
      data={data}
      relatedEvents={relatedEvents}
      slug={slug}
    />
  );
}