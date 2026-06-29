"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { type ConsumerAccount } from "@/app/lib/localState";
import {
  fetchHomescreen,
  type EventFeedItem,
  type FeedItem,
  type HomescreenApiResponse,
  type OnFireVenueItem,
  type SocialEnergyAlertItem,
  type SocialPostItem,
  type SuggestedProducerItem,
  type TrendingVenue,
  type UpcomingEvent,
} from "@/app/lib/publicApiClient";
import { type FlowAnchor } from "@/app/components/single-page/ui";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatEventDate(raw?: string): string {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return raw;
  }
}

function upcomingEventToFeedItem(evt: UpcomingEvent, index: number): EventFeedItem {
  return {
    feed_type: "event",
    id: evt.id,
    title: evt.title,
    venue_name: evt.venue_name,
    start_time: evt.start_time,
    event_date: formatEventDate(evt.event_date),
    cover_image_url: evt.cover_image_url,
    going_count: evt.going_count ?? evt.rsvp_count,
    is_on_fire: evt.is_on_fire ?? false,
    badge: index === 0 ? "Happening Soon" : undefined,
    raw: evt,
  };
}

function venueImage(v: TrendingVenue): string | null {
  return v.image_primary_url || v.image_fallback_url || v.cover_image_url || v.image_url || null;
}

function VenueImagePlaceholder({ name }: { name: string }) {
  return (
    <div className="absolute inset-0 flex items-end bg-gradient-to-br from-zinc-800 to-zinc-900 p-2">
      <div className="flex items-center gap-1 text-white/40">
        <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" /><path d="m3 9 4-4 4 4 5-5 5 5" /><circle cx="8.5" cy="13.5" r="1.5" />
        </svg>
        <span className="truncate text-[0.6rem]">{name}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function FeaturedGrid({
  venues,
  onOpen,
}: {
  venues: TrendingVenue[];
  onOpen: (id: number | string) => void;
}) {
  if (!venues.length) return null;
  const neighborhood = (v: TrendingVenue) =>
    v.neighborhood_text || v.area_neighborhood || v.neighborhood || null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {venues.slice(0, 4).map((v) => {
        const img = venueImage(v);
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onOpen(v.id)}
            className="relative h-36 overflow-hidden rounded-[14px]"
          >
            {img ? (
              <Image
                src={img}
                alt={v.venue_name}
                fill
                sizes="(max-width: 448px) 44vw, 200px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <VenueImagePlaceholder name={v.venue_name} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
            {v.is_on_fire ? (
              <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-red-600 px-2 py-0.5 text-[0.58rem] font-bold text-white">
                🔥 ON FIRE
              </span>
            ) : null}
            <span className="absolute bottom-2 left-2 right-2 text-left text-[0.72rem] font-semibold leading-tight text-white drop-shadow">
              {v.venue_name}
              {neighborhood(v) ? (
                <span className="block text-[0.62rem] font-normal text-white/70">
                  {neighborhood(v)}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EventFeedCard({
  item,
  onOpen,
}: {
  item: EventFeedItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full overflow-hidden rounded-[18px] bg-black/40 text-left"
    >
      {/* Cover image */}
      <div className="relative h-44 w-full bg-zinc-900">
        {item.cover_image_url ? (
          <Image
            src={item.cover_image_url}
            alt={item.title}
            fill
            sizes="(max-width: 448px) 100vw, 448px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-white/20" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="m3 9 4-4 4 4 5-5 5 5" /><circle cx="8.5" cy="13.5" r="1.5" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        {item.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[0.62rem] font-medium text-white backdrop-blur-sm">
            {item.badge}
          </span>
        ) : null}
        {item.is_on_fire ? (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[0.62rem] font-bold text-white">
            🔥 ON FIRE
          </span>
        ) : null}
      </div>

      {/* Details */}
      <div className="px-3 py-3">
        <h3 className="text-[1rem] font-bold leading-snug text-white">
          {item.title}
        </h3>

        <div className="mt-1.5 space-y-1">
          {item.venue_name ? (
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none text-red-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span className="text-[0.78rem] text-white/70">{item.venue_name}</span>
            </div>
          ) : null}
          {(item.start_time || item.event_date) ? (
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none text-red-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-[0.78rem] text-white/70">
                {[item.start_time ? item.start_time.slice(0, 5) : null, item.event_date]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          ) : null}
        </div>

        {item.going_count ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-5 w-5 rounded-full border border-black/40 bg-gradient-to-br from-red-400 to-red-700" />
              ))}
            </div>
            <span className="text-[0.72rem] text-white/65">
              {item.going_count} Going
              {item.people_you_know ? ` · ${item.people_you_know} people you may know` : ""}
            </span>
          </div>
        ) : null}

        {item.producer ? (
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-800 text-[0.5rem] font-bold text-white">
                {item.producer.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[0.72rem] font-semibold text-white">{item.producer.name}</p>
                {item.producer.event_count ? (
                  <p className="text-[0.62rem] text-white/50">
                    Suggested · {item.producer.event_count} events this month
                  </p>
                ) : null}
              </div>
            </div>
            <span className="rounded-full border border-white/30 px-3 py-1 text-[0.65rem] font-semibold text-white">
              Follow
            </span>
          </div>
        ) : null}

        {item.reason ? (
          <p className="mt-2.5 text-[0.65rem] text-white/40">{item.reason}</p>
        ) : null}
      </div>
    </button>
  );
}

function EnergyAlertBanner({ item }: { item: SocialEnergyAlertItem }) {
  const parts = item.message.split("on fire");
  return (
    <div className="flex items-center justify-between rounded-[14px] bg-black/40 px-4 py-3">
      <p className="text-[0.82rem] leading-5 text-white/85">
        {parts[0]}
        <span className="font-semibold text-red-400">on fire</span>
        {parts[1]}
      </p>
      <svg viewBox="0 0 24 24" className="ml-3 h-4 w-4 flex-none text-white/50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

function SocialPostCard({ item }: { item: SocialPostItem }) {
  return (
    <div className="overflow-hidden rounded-[18px] bg-black/40">
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-red-800 text-[0.55rem] font-bold text-white">
            {item.author_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[0.78rem] font-semibold text-white">Social Bevy</p>
            <p className="text-[0.65rem] text-white/50">{item.author_name} · {item.time_ago}</p>
          </div>
        </div>
        {item.notification_count ? (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[0.6rem] font-bold text-white">
            {item.notification_count}
          </span>
        ) : null}
      </div>
      <p className="mt-2 px-3 text-[0.82rem] leading-5 text-white/80">{item.body}</p>
      {item.image_url ? (
        <div className="relative mt-2.5 h-44 w-full">
          <Image src={item.image_url} alt="Post" fill sizes="(max-width: 448px) 100vw, 448px" className="object-cover" unoptimized />
        </div>
      ) : null}
      <div className="px-3 pb-3 pt-2.5">
        {item.comment_count ? (
          <button type="button" className="text-[0.72rem] text-white/50">
            View all {item.comment_count} comments
          </button>
        ) : null}
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
          <span className="text-[0.75rem] text-white/30">Add a comment...</span>
          <span className="text-[0.72rem] font-semibold text-red-400">Post</span>
        </div>
      </div>
    </div>
  );
}

function OnFireVenueCard({ item, onViewVenue }: { item: OnFireVenueItem; onViewVenue: () => void }) {
  function handleGetRide() {
    const query = item.venue_address || item.venue_name;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
  }
  return (
    <div className="overflow-hidden rounded-[18px] bg-black/40 px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-yellow-400">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />ON FIRE
        </span>
        {(item.neighborhood || item.category) ? (
          <span className="text-[0.65rem] text-white/50">{[item.neighborhood, item.category].filter(Boolean).join(" · ")}</span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <h3 className="text-[1.1rem] font-bold text-white">{item.venue_name}</h3>
        {item.going_count ? (
          <div className="text-right">
            <p className="text-[1rem] font-bold leading-none text-white">{item.going_count}</p>
            <p className="text-[0.6rem] text-white/50">Going</p>
          </div>
        ) : null}
      </div>
      {item.description ? <p className="mt-1.5 text-[0.78rem] leading-5 text-white/65">{item.description}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={handleGetRide} className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-white/20 py-2.5 text-[0.72rem] font-semibold text-white/85">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2" /><path d="M16 8h4l3 5v3h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          Get a Ride
        </button>
        <button type="button" onClick={onViewVenue} className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-white/20 py-2.5 text-[0.72rem] font-semibold text-white/85">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          View Venue
        </button>
      </div>
    </div>
  );
}

function SuggestedProducerCard({ item }: { item: SuggestedProducerItem }) {
  return (
    <div className="flex items-center justify-between rounded-[18px] bg-black/40 px-4 py-4">
      <div>
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-white/40">Suggested Producer</p>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-800 text-[0.6rem] font-bold text-white">
            {item.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[0.82rem] font-semibold text-white">{item.name}</p>
            {item.event_count ? <p className="text-[0.65rem] text-white/50">Suggested · {item.event_count} events this month</p> : null}
          </div>
        </div>
      </div>
      <button type="button" className="rounded-full border border-white/30 px-4 py-1.5 text-[0.72rem] font-semibold text-white">
        Follow
      </button>
    </div>
  );
}

function FeedCard({
  item,
  onEventOpen,
  onVenueOpen,
}: {
  item: FeedItem;
  onEventOpen: (evt: UpcomingEvent) => void;
  onVenueOpen: (id: string | number) => void;
}) {
  if (item.feed_type === "event") return <EventFeedCard item={item} onOpen={() => onEventOpen(item.raw)} />;
  if (item.feed_type === "social_energy_alert") return <EnergyAlertBanner item={item} />;
  if (item.feed_type === "social_post") return <SocialPostCard item={item} />;
  if (item.feed_type === "on_fire_venue") return <OnFireVenueCard item={item} onViewVenue={() => onVenueOpen(item.id)} />;
  if (item.feed_type === "suggested_producer") return <SuggestedProducerCard item={item} />;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

type HomescreenSectionProps = {
  account: ConsumerAccount | null;
  navigateTo: (screen: FlowAnchor) => void;
  onVenueOpen: (id: string | number) => void;
  onEventOpen: (evt: UpcomingEvent) => void;
  onMenuOpen: () => void;
  onOrbTap: () => void;
  userCoords?: { latitude: number; longitude: number } | null;
};

export function HomescreenSection({
  account,
  onVenueOpen,
  onEventOpen,
  onMenuOpen,
  userCoords,
}: HomescreenSectionProps) {
  const [apiData, setApiData] = useState<HomescreenApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [allEvents, setAllEvents] = useState<UpcomingEvent[]>([]);
  const [eventsPage, setEventsPage] = useState(1);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const cityId = 1;
  const cityName = "Houston";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setAllEvents([]);
    setEventsPage(1);
    setHasMoreEvents(true);

    fetchHomescreen({
      cityId,
      cityName,
      userId: account?.id ?? undefined,
      lat: userCoords?.latitude,
      lng: userCoords?.longitude,
      page: 1,
    })
      .then((result) => {
        if (!cancelled) {
          setApiData(result);
          const events = result.upcoming_events ?? [];
          setAllEvents(events);
          if (events.length < 5) setHasMoreEvents(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Could not load feed.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [account?.id, userCoords?.latitude, userCoords?.longitude]);

  const loadMoreEvents = useCallback(() => {
    if (loadingMore || !hasMoreEvents) return;
    setLoadingMore(true);
    const nextPage = eventsPage + 1;
    fetchHomescreen({
      cityId,
      cityName,
      userId: account?.id ?? undefined,
      lat: userCoords?.latitude,
      lng: userCoords?.longitude,
      page: nextPage,
    })
      .then((result) => {
        const newEvents = result.upcoming_events ?? [];
        setAllEvents((prev) => [...prev, ...newEvents]);
        setEventsPage(nextPage);
        if (newEvents.length < 5) setHasMoreEvents(false);
      })
      .catch(() => { setHasMoreEvents(false); })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMoreEvents, eventsPage, account?.id, userCoords?.latitude, userCoords?.longitude]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMoreEvents) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreEvents(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMoreEvents, hasMoreEvents]);

  const displayData = apiData;

  // Build the unified feed from accumulated events
  const eventFeedItems: FeedItem[] = allEvents.map(
    (evt, i) => upcomingEventToFeedItem(evt, i)
  );

  return (
    <section className="flex flex-1 flex-col overflow-y-auto pb-28">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 py-3">
        <div className="flex items-center gap-2">
          <div className="relative h-9 w-9 overflow-hidden rounded-full">
            <Image src="/icons/top_bar_genie.png" alt="Social Bevy" fill sizes="36px" className="object-contain" />
          </div>
          <div>
            <p className="text-[0.85rem] font-bold leading-none text-white">Social Bevy</p>
            <p className="text-[0.65rem] text-white/50">
              {account ? `${account.firstName} ${account.lastName}`.trim() || "Consumer" : "Consumer"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {account?.firstName ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-red-800 text-[0.65rem] font-bold text-white">
              {account.firstName.slice(0, 1).toUpperCase()}
            </div>
          ) : null}
          <button type="button" onClick={onMenuOpen} className="flex h-9 w-9 flex-col items-center justify-center gap-[4.5px]" aria-label="Menu">
            <span className="block h-[2px] w-5 rounded-full bg-white/80" />
            <span className="block h-[2px] w-5 rounded-full bg-white/80" />
            <span className="block h-[2px] w-5 rounded-full bg-white/80" />
          </button>
        </div>
      </div>

      {loading ? (
        /* ── Skeleton ─────────────────────────────────────────────── */
        <div className="space-y-4 px-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="h-36 animate-pulse rounded-[14px] bg-white/10" />
            <div className="h-36 animate-pulse rounded-[14px] bg-white/10" />
          </div>
          <div className="h-72 animate-pulse rounded-[18px] bg-white/10" />
          <div className="h-14 animate-pulse rounded-[14px] bg-white/10" />
          <div className="h-72 animate-pulse rounded-[18px] bg-white/10" />
        </div>
      ) : fetchError ? (
        /* ── Error ────────────────────────────────────────────────── */
        <div className="mt-16 flex flex-col items-center gap-3 px-6 text-center">
          <p className="text-[0.85rem] text-white/40">Could not load your feed.</p>
          <p className="text-[0.72rem] text-white/25">{fetchError}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); setFetchError(null); fetchHomescreen({ cityId: 1, cityName: "Houston", userId: account?.id ?? undefined }).then(setApiData).catch((e: unknown) => setFetchError(e instanceof Error ? e.message : "Error")).finally(() => setLoading(false)); }}
            className="mt-2 rounded-full border border-white/20 px-5 py-2 text-[0.78rem] font-semibold text-white/70"
          >
            Try Again
          </button>
        </div>
      ) : displayData ? (
        <div className="space-y-4 px-1">
          {/* Featured (trending venues) */}
          {(displayData.trending_venues ?? []).length > 0 ? (
            <div>
              <h2 className="mb-3 font-[family:var(--font-display)] text-[1.4rem] text-white">
                Featured
              </h2>
              <FeaturedGrid
                venues={displayData.trending_venues ?? []}
                onOpen={onVenueOpen}
              />
            </div>
          ) : (
            <div className="rounded-[14px] bg-black/20 px-4 py-5 text-center">
              <p className="text-[0.82rem] text-white/40">No featured venues right now.</p>
            </div>
          )}

          {/* Upcoming Events feed */}
          {eventFeedItems.length > 0 ? (
            <div>
              <h2 className="mb-3 font-[family:var(--font-display)] text-[1.4rem] text-white">
                Your Bevy
              </h2>
              <div className="space-y-3">
                {eventFeedItems.map((item) => (
                  <FeedCard
                    key={`${item.feed_type}-${item.id}`}
                    item={item}
                    onEventOpen={onEventOpen}
                    onVenueOpen={onVenueOpen}
                  />
                ))}
              </div>
              <div ref={sentinelRef} className="h-4" />
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
              )}
              {!hasMoreEvents && (
                <p className="py-6 text-center text-[0.78rem] text-white/35">
                  You&apos;ve seen all upcoming events
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-[18px] bg-black/20 px-4 py-8 text-center">
              <p className="text-[0.85rem] text-white/40">No upcoming events in your city right now.</p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
