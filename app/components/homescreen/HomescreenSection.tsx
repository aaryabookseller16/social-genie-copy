"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

import { type ConsumerAccount } from "@/app/lib/localState";
import { type GenieVenue } from "@/app/lib/genieTypes";
import {
  fetchFollowedProducers,
  fetchHomescreen,
  fetchHomescreenEvents,
  fetchHomescreenInfluencerOffers,
  fetchHomescreenPosts,
  fetchSuggestedProducers,
  fetchTrendingVenues,
  followProducer,
  rsvpToEvent,
  type EventFeedItem,
  type FollowedProducerItem,
  type HomescreenInfluencerOffer,
  type HomescreenLocation,
  type HomescreenNeighborhood,
  type HomescreenPlacement,
  type OnFireVenueItem,
  type PublicPost,
  type PublicPostAuthor,
  type SuggestedProducerItem,
  type TrendingVenue,
  type UpcomingEvent,
} from "@/app/lib/publicApiClient";
import { mediaGalleryFor } from "@/app/lib/image";
import { getEventBadge } from "@/app/lib/eventBadge";
import ImageGallery from "@/app/components/ImageGallery";
import FeaturedVideoRail from "@/app/components/homescreen/FeaturedVideoRail";
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

function formatShortRelativeTime(timestamp?: number): string {
  if (!timestamp) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}

function formatEventTime(raw?: string): string {
  if (!raw) return "";
  const [h, m] = raw.split(":");
  const hour = Number(h);
  if (Number.isNaN(hour)) return raw;
  const period = hour >= 12 ? "PM" : "AM";
  const hr12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hr12}:${m ?? "00"} ${period}`;
}

function upcomingEventToFeedItem(evt: UpcomingEvent): EventFeedItem {
  // Producer is embedded in each event by the events rail, already projected to
  // {id, name, image_url, event_count, is_verified, is_following}.
  const p = evt.producer;
  const producer = p?.name
    ? {
        name: p.name,
        image_url: p.image_url,
        event_count: p.event_count,
        producer_id: p.id,
        is_verified: p.is_verified,
        is_following: p.is_following,
      }
    : undefined;
  return {
    feed_type: "event",
    id: evt.id,
    title: evt.title,
    // The rail carries no venue name — only the address (see the file header).
    venue_address: evt.venue_address,
    start_time: evt.start_time,
    event_date: formatEventDate(evt.event_date),
    cover_image_url: evt.cover_image_url,
    going_count: evt.going_count,
    // Energy and live status are separate signals: an event can be upcoming
    // and on_fire at once, so neither implies the other.
    is_on_fire: evt.social_energy_state === "on_fire",
    is_live: evt.is_live === true,
    // Earned by the date, not by position in the list — a card that isn't
    // actually today must never claim "tonight". Recomputed from event_date
    // on every render, so editing an event's date changes the badge for free.
    badge: !evt.is_live ? getEventBadge(evt.event_date) : undefined,
    producer_id: p?.id,
    producer,
    raw: evt,
  };
}

function trendingVenueToFeedItem(v: TrendingVenue): OnFireVenueItem {
  return {
    feed_type: "on_fire_venue",
    id: v.id,
    venue_name: v.name,
    venue_latitude: v.latitude,
    venue_longitude: v.longitude,
    neighborhood: v.neighborhood || undefined,
    // Empty until venue enrichment runs — undefined so the card drops the
    // "Midtown · Bar & Grill" separator rather than rendering a dangling one.
    category: v.category || undefined,
    description: v.description || undefined,
    image_url: v.image_url || undefined,
    going_count: v.going_count || v.checkin_count,
    is_on_fire: v.social_energy_state === "on_fire",
    uber_deeplink: v.uber_deeplink || undefined,
  };
}

/* Local feed items that also carry a standalone row of multiple cards. */
type SuggestedProducersFeedItem = {
  feed_type: "suggested_producers";
  id: string;
  producers: SuggestedProducerItem[];
};
type SocialPostFeedItem = {
  feed_type: "social_post";
  id: number;
  post: PublicPost;
  author: PublicPostAuthor | null;
};
type NeighborhoodPulseFeedItem = {
  feed_type: "neighborhood_pulse";
  id: number;
  neighborhood: HomescreenNeighborhood;
  spikingCount: number;
  topVenueId?: number;
};
type OffersFeedItem = {
  feed_type: "offers";
  id: string;
  placements: HomescreenPlacement[];
};
type InfluencerOffersFeedItem = {
  feed_type: "influencer_offers";
  id: string;
  offers: HomescreenInfluencerOffer[];
};
type HomeFeedItem =
  | EventFeedItem
  | SocialPostFeedItem
  | OnFireVenueItem
  | SuggestedProducersFeedItem
  | NeighborhoodPulseFeedItem
  | OffersFeedItem
  | InfluencerOffersFeedItem;

/* ------------------------------------------------------------------ */
/*  Story bar                                                           */
/* ------------------------------------------------------------------ */

function StoryBar({ producers }: { producers: FollowedProducerItem[] }) {
  if (!producers.length) return null;
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {producers.map((p) => (
        <a key={p.id} href={`/p/${p.id}`} className="flex w-16 flex-none flex-col items-center gap-1">
          <span className="rounded-full bg-gradient-to-tr from-red-600 via-red-500 to-orange-400 p-[2px]">
            <span className="block rounded-full bg-white dark:bg-black p-[2px]">
              <span className="relative block h-14 w-14 overflow-hidden rounded-full">
                {p.profile_photo_url ? (
                  <Image
                    src={p.profile_photo_url}
                    alt={p.display_name ?? "Producer"}
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <ProducerAvatar name={p.display_name ?? "?"} size={56} />
                )}
              </span>
            </span>
          </span>
          <span className="w-full truncate text-center text-[0.62rem] text-gray-600 dark:text-white/70">
            {p.display_name ?? "Producer"}
          </span>
        </a>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Producer follow block (shared by event card + suggested producer)  */
/* ------------------------------------------------------------------ */

function useFollow(producerId: number, source: string, initialFollowing = false) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followBusy, setFollowBusy] = useState(false);

  // Sync when the embedded is_following value arrives / changes.
  useEffect(() => {
    setIsFollowing(initialFollowing);
  }, [initialFollowing]);

  const toggle = useCallback(async () => {
    if (followBusy) return;
    setFollowBusy(true);
    const optimistic = !isFollowing;
    setIsFollowing(optimistic);
    try {
      const res = await followProducer(producerId, source);
      setIsFollowing(res.action === "followed");
    } catch {
      setIsFollowing(!optimistic);
    } finally {
      setFollowBusy(false);
    }
  }, [followBusy, isFollowing, producerId, source]);

  return { isFollowing, followBusy, toggle };
}

function FollowButton({
  isFollowing,
  followBusy,
  onClick,
}: {
  isFollowing: boolean;
  followBusy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={followBusy}
      className={`rounded-full border px-4 py-1.5 text-[0.72rem] font-semibold transition ${
        isFollowing ? "border-red-500 bg-red-600 text-white" : "border-gray-300 text-gray-700 dark:border-white/30 dark:text-white"
      } disabled:opacity-50`}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

function ProducerAvatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full bg-red-800 font-bold text-white"
      style={{ height: size, width: size, fontSize: size * 0.32 }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Event card                                                          */
/* ------------------------------------------------------------------ */

function EventFeedCard({
  item,
  onOpen,
  isLoggedIn,
  onRequireAuth,
}: {
  item: EventFeedItem;
  onOpen: () => void;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
}) {
  // Persisted as a "saved" RSVP — the same record the Liked tab reads back
  // (/api/events/saved). The rail doesn't return the viewer's existing rsvp
  // status, so this starts unset each load and only reflects taps made here;
  // see the backend follow-ups.
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const producer = item.producer;
  const follow = useFollow(
    producer?.producer_id ?? item.id,
    "homescreen",
    producer?.is_following ?? false
  );
  const profileHref = producer?.producer_id ? `/p/${producer.producer_id}` : undefined;

  const handleFollow = () => {
    if (!isLoggedIn) return onRequireAuth();
    void follow.toggle();
  };
  const handleSave = async () => {
    if (!isLoggedIn) return onRequireAuth();
    if (saveBusy) return;
    setSaveBusy(true);
    const optimistic = !saved;
    setSaved(optimistic);
    try {
      await rsvpToEvent(item.id, optimistic ? "saved" : "removed", "homescreen");
    } catch {
      setSaved(!optimistic);
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-[18px] bg-white/90 dark:bg-black/40">
      {/* Cover image */}
      <button type="button" onClick={onOpen} className="relative block h-44 w-full bg-zinc-900">
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
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-gray-300 dark:text-white/20" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="m3 9 4-4 4 4 5-5 5 5" /><circle cx="8.5" cy="13.5" r="1.5" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        {item.is_live ? (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wide text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
        ) : item.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[0.62rem] font-medium text-white backdrop-blur-sm">
            {item.badge}
          </span>
        ) : null}
        {item.is_on_fire ? (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[0.62rem] font-bold text-white">
            🔥 ON FIRE
          </span>
        ) : null}
      </button>

      {/* Details */}
      <div className="px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOpen} className="text-left">
            <h3 className="text-[1rem] font-bold leading-snug text-gray-900 dark:text-white">{item.title}</h3>
          </button>
          <button
            type="button"
            aria-label={saved ? "Unsave" : "Save"}
            onClick={handleSave}
            disabled={saveBusy}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-gray-200 dark:border-white/25 disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 ${saved ? "text-red-500" : "text-gray-700 dark:text-white/80"}`}
              fill={saved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
          </button>
        </div>

        <button type="button" onClick={onOpen} className="mt-1.5 block w-full text-left">
          <div className="space-y-1">
            {item.venue_address ? (
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none text-red-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                <span className="truncate text-[0.78rem] text-gray-600 dark:text-white/70">{item.venue_address}</span>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {item.start_time ? (
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none text-red-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="text-[0.78rem] text-gray-600 dark:text-white/70">{formatEventTime(item.start_time)} - Late</span>
                </div>
              ) : null}
              {item.event_date ? (
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none text-red-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="text-[0.78rem] text-gray-600 dark:text-white/70">{item.event_date}</span>
                </div>
              ) : null}
            </div>
          </div>

          {item.going_count ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[0.72rem] text-gray-600 dark:text-white/65">{item.going_count} Going</span>
            </div>
          ) : null}
        </button>

        {producer ? (
          <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-white/10 pt-2.5">
            <a
              href={profileHref}
              onClick={(e) => {
                e.stopPropagation();
                if (!isLoggedIn) {
                  e.preventDefault();
                  onRequireAuth();
                }
              }}
              className="flex min-w-0 items-center gap-2"
            >
              {producer.image_url ? (
                <span className="relative h-7 w-7 flex-none overflow-hidden rounded-full">
                  <Image src={producer.image_url} alt={producer.name} fill sizes="28px" className="object-cover" unoptimized />
                </span>
              ) : (
                <ProducerAvatar name={producer.name} />
              )}
              <div className="min-w-0">
                <p className="truncate text-[0.78rem] font-semibold text-gray-900 dark:text-white">{producer.name}</p>
                {/* event_count is the producer's live event total — not a
                    monthly figure, and nothing here is "suggested". */}
                {producer.event_count ? (
                  <p className="text-[0.62rem] text-gray-500 dark:text-white/50">
                    {producer.event_count} live {producer.event_count === 1 ? "event" : "events"}
                  </p>
                ) : null}
              </div>
            </a>
            <FollowButton isFollowing={follow.isFollowing} followBusy={follow.followBusy} onClick={handleFollow} />
          </div>
        ) : null}

      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Social post card                                                    */
/*  Preview-only: real content (text/media/counts) always renders;      */
/*  opening the full post (and any liking/commenting) happens on        */
/*  /posts/[id], gated behind login like the rest of this screen.       */
/* ------------------------------------------------------------------ */

function SocialPostCard({
  item,
  isLoggedIn,
  onRequireAuth,
}: {
  item: SocialPostFeedItem;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
}) {
  const { post, author } = item;
  const authorName = author?.display_name ?? "Social Bevy";
  const media = mediaGalleryFor(post.image_url, post.image_urls, post.video_urls);

  const handleOpen = (e: MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault();
      onRequireAuth();
    }
  };

  return (
    <div className="overflow-hidden rounded-[18px] bg-white/90 dark:bg-black/40">
      <Link href={`/posts/${post.id}`} onClick={handleOpen} className="block">
        <div className="flex items-center gap-2 px-3 pt-3">
          {author?.profile_photo_url ? (
            <div className="relative h-8 w-8 flex-none overflow-hidden rounded-full">
              <Image
                src={author.profile_photo_url}
                alt={authorName}
                fill
                sizes="32px"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <ProducerAvatar name={authorName} size={32} />
          )}
          <div>
            <p className="text-[0.78rem] font-semibold text-gray-900 dark:text-white">{authorName}</p>
            <p className="text-[0.65rem] text-gray-500 dark:text-white/50">{formatShortRelativeTime(post.created_at)}</p>
          </div>
        </div>
        {post.post_text ? (
          <p className="mt-2 px-3 text-[0.82rem] leading-5 text-gray-700 dark:text-white/80">{post.post_text}</p>
        ) : null}
        {media.length > 0 ? (
          <div className="mt-2.5">
            <ImageGallery
              items={media}
              alt={post.post_text ?? "Post"}
              heightClass="h-44"
              showThumbnails={false}
            />
          </div>
        ) : null}
      </Link>
      <div className="px-3 pb-3 pt-2.5">
        <Link
          href={`/posts/${post.id}`}
          onClick={handleOpen}
          className="flex items-center justify-between border-t border-gray-200 dark:border-white/10 pt-2"
        >
          <span className="text-[0.72rem] text-gray-500 dark:text-white/50">
            {post.like_count ? `${post.like_count} like${post.like_count === 1 ? "" : "s"}` : "Like"}
            {post.comment_count
              ? ` · ${post.comment_count} comment${post.comment_count === 1 ? "" : "s"}`
              : ""}
          </span>
          <span className="text-[0.72rem] font-semibold text-red-400">View post</span>
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  On-fire venue card                                                 */
/* ------------------------------------------------------------------ */

function OnFireVenueCard({
  item,
  onViewVenue,
  isSaved,
  isLoggedIn,
  onRequireAuth,
  onToggleSaveVenue,
}: {
  item: OnFireVenueItem;
  onViewVenue: () => void;
  isSaved: boolean;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
  onToggleSaveVenue: (venue: GenieVenue) => void;
}) {
  function handleToggleSave() {
    if (!isLoggedIn) return onRequireAuth();
    onToggleSaveVenue({
      id: item.id,
      venue_name: item.venue_name,
      image: item.image_url ?? null,
      image_url: item.image_url ?? null,
      latitude: item.venue_latitude ?? null,
      longitude: item.venue_longitude ?? null,
      area_neighborhood: item.neighborhood ?? null,
    });
  }
  function handleGetRide() {
    // Prefer the venue's own prebuilt link; it's empty for most venues in dev
    // data, so fall back to a coordinate-built one rather than hiding the CTA.
    const hasCoords = item.venue_latitude != null && item.venue_longitude != null;
    const coordParams = hasCoords
      ? `&dropoff[latitude]=${item.venue_latitude}&dropoff[longitude]=${item.venue_longitude}`
      : "";
    // uber_deeplink is backend/enrichment data, so it is not trusted to be a
    // web URL — window.open would happily run a `javascript:` value. Only an
    // http(s) link is used; anything else falls back to the built one.
    const isWebUrl = (value?: string) => {
      if (!value) return false;
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    };
    const url = isWebUrl(item.uber_deeplink)
      ? (item.uber_deeplink as string)
      : `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[nickname]=${encodeURIComponent(item.venue_name)}${coordParams}&dropoff[formatted_address]=${encodeURIComponent(item.venue_name)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return (
    <div className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-red-950/70 to-black/50 px-4 py-4">
      {item.image_url ? (
        <>
          <Image
            src={item.image_url}
            alt=""
            aria-hidden="true"
            fill
            sizes="(max-width: 448px) 100vw, 448px"
            className="object-cover"
            unoptimized
          />
          {/* Venue photos are often bright signage that competes with the card
              copy, so the scrim is deliberately heavy — the image reads as
              texture, not as content. */}
          <div className="absolute inset-0 bg-black/70" />
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/85 via-black/70 to-black/85" />
        </>
      ) : null}
      <div className="relative">
      <div className="flex items-center justify-between gap-2">
        {item.is_on_fire ? (
          <span className="flex flex-none items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-yellow-400">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />ON FIRE
          </span>
        ) : <span />}
        <div className="flex min-w-0 items-center gap-2">
          {(item.neighborhood || item.category) ? (
            // Neighborhood names run long ("Washington Avenue Coalition /
            // Memorial Park"), so truncate rather than let them push the
            // ON FIRE pill off the card on narrow screens.
            <span className="min-w-0 truncate text-right text-[0.65rem] text-white/50">
              {[item.neighborhood, item.category].filter(Boolean).join(" · ")}
            </span>
          ) : null}
          <button
            type="button"
            aria-label={isSaved ? "Unsave" : "Save"}
            onClick={handleToggleSave}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-white/25 bg-black/30"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 ${isSaved ? "text-red-500" : "text-white/80"}`}
              fill={isSaved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-[1.1rem] font-bold leading-tight text-white">{item.venue_name}</h3>
        {item.going_count ? (
          <div className="flex-none text-right">
            <p className="text-[1.1rem] font-bold leading-none text-white">{item.going_count}</p>
            <p className="text-[0.6rem] text-white/50">Going</p>
            {item.is_on_fire ? (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[0.55rem] font-bold text-white">
                🔥 ON FIRE
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {item.description ? <p className="mt-2 text-[0.78rem] leading-5 text-white/65">{item.description}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={handleGetRide} className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-red-600 py-2.5 text-[0.72rem] font-semibold text-white">
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Suggested producer card                                            */
/* ------------------------------------------------------------------ */

function SuggestedProducerCard({
  item,
  isLoggedIn,
  onRequireAuth,
}: {
  item: SuggestedProducerItem;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
}) {
  const follow = useFollow(item.producer_id ?? item.id, "homescreen");
  const profileHref = `/p/${item.producer_id ?? item.id}`;

  const handleFollow = () => {
    if (!isLoggedIn) return onRequireAuth();
    void follow.toggle();
  };

  return (
    <div className="overflow-hidden rounded-[18px] bg-white/90 dark:bg-black/40">
      <p className="px-4 pt-3.5 text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">
        Suggested Producer
      </p>
      <div className="flex items-center justify-between px-4 pb-4 pt-2">
        <a
          href={profileHref}
          onClick={(e) => {
            if (!isLoggedIn) {
              e.preventDefault();
              onRequireAuth();
            }
          }}
          className="flex min-w-0 items-center gap-2.5"
        >
          {item.image_url ? (
            <span className="relative h-9 w-9 flex-none overflow-hidden rounded-full">
              <Image src={item.image_url} alt={item.name} fill sizes="36px" className="object-cover" unoptimized />
            </span>
          ) : (
            <ProducerAvatar name={item.name} size={36} />
          )}
          <div className="min-w-0">
            <p className="truncate text-[0.82rem] font-semibold text-gray-900 dark:text-white">{item.name}</p>
            {item.event_count ? (
              <p className="text-[0.65rem] text-gray-500 dark:text-white/50">
                {item.event_count} live {item.event_count === 1 ? "event" : "events"}
              </p>
            ) : null}
          </div>
        </a>
        <FollowButton isFollowing={follow.isFollowing} followBusy={follow.followBusy} onClick={handleFollow} />
      </div>
    </div>
  );
}

function SuggestedProducersRow({
  producers,
  isLoggedIn,
  onRequireAuth,
}: {
  producers: SuggestedProducerItem[];
  isLoggedIn: boolean;
  onRequireAuth: () => void;
}) {
  if (!producers.length) return null;
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {producers.map((p) => (
        <div key={p.id} className="w-64 flex-none">
          <SuggestedProducerCard item={p} isLoggedIn={isLoggedIn} onRequireAuth={onRequireAuth} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Neighborhood pulse banner                                           */
/* ------------------------------------------------------------------ */

const SPIKING_STATES = new Set(["on_fire", "buzzing"]);

function NeighborhoodPulse({
  neighborhood,
  spikingCount,
  onOpen,
}: {
  neighborhood: HomescreenNeighborhood;
  spikingCount: number;
  onOpen?: () => void;
}) {
  const state = neighborhood.social_energy_state === "on_fire" ? "on fire" : "buzzing";
  // venue_count on the table is the neighborhood's total venues, not how many
  // are spiking, so the count is derived from the venues we actually loaded —
  // and dropped entirely when we can't back it up.
  const detail =
    spikingCount > 1 ? ` — ${spikingCount} venues spiking right now.` : " right now.";

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className="flex w-full items-center gap-3 rounded-[18px] bg-gradient-to-r from-red-950/70 to-black/40 px-4 py-3 text-left disabled:cursor-default"
    >
      <span className="h-2 w-2 flex-none animate-pulse rounded-full bg-red-500" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-[0.82rem] leading-5 text-gray-700 dark:text-white/85">
        {neighborhood.name} just hit <span className="font-semibold text-red-400">{state}</span>
        {detail}
      </span>
      {onOpen ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-gray-400 dark:text-white/40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Offers rail                                                         */
/* ------------------------------------------------------------------ */

function OffersRow({
  placements,
  onSeeAll,
  onOpen,
}: {
  placements: HomescreenPlacement[];
  onSeeAll: () => void;
  onOpen: (venueId: number) => void;
}) {
  if (!placements.length) return null;
  return (
    <div>
      <button
        type="button"
        onClick={onSeeAll}
        className="mb-3 flex w-full items-center justify-between"
      >
        <span className="font-[family:var(--font-display)] text-[1.4rem] text-gray-900 dark:text-white">Offers</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-500 dark:text-white/50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {placements.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => p.venue_id && onOpen(p.venue_id)}
            className="w-40 flex-none overflow-hidden rounded-[16px] bg-white/90 dark:bg-black/40 text-left"
          >
            <span className="relative block h-24 w-full bg-zinc-900">
              {p.creative_url ? (
                <Image
                  src={p.creative_url}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="160px"
                  className="object-cover"
                  unoptimized
                />
              ) : null}
            </span>
            <span className="block px-2.5 py-2">
              <span className="block truncate text-[0.78rem] font-semibold text-gray-900 dark:text-white">
                {p.creative_title ?? "Offer"}
              </span>
              {p.creative_description ? (
                <span className="mt-0.5 block line-clamp-2 text-[0.65rem] leading-4 text-gray-500 dark:text-white/60">
                  {p.creative_description}
                </span>
              ) : null}
              {p.placement_type ? (
                <span className="mt-1.5 inline-block rounded-full bg-red-600 px-2 py-0.5 text-[0.55rem] font-bold text-white">
                  {p.placement_type}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Influencer offers row                                               */
/* ------------------------------------------------------------------ */

/** "discount_code" -> "Discount Code"; trims stray whitespace from seed data. */
function formatOfferBadge(offerType?: string): string | undefined {
  const cleaned = offerType?.trim().replace(/_/g, " ");
  if (!cleaned) return undefined;
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function InfluencerOfferCard({ offer }: { offer: HomescreenInfluencerOffer }) {
  const [copied, setCopied] = useState(false);
  const imageUrl = offer.image_urls?.[0] || offer.venue_info?.image_url;
  const context = offer.venue_info?.name ?? offer.event?.title ?? "Offer";
  const badge = formatOfferBadge(offer.offer_type);
  const promoCode = offer.promo_code?.trim();
  // The real offer detail/redeem page lives at /i/[handle]/[code] — it looks
  // the offer up by matching promo_code for that influencer, so both are
  // required to link there. Falls back to copy-to-clipboard when the
  // influencer didn't resolve (a real data gap on some rows today) rather
  // than linking to a page that would 404.
  const detailHref =
    offer.influencer?.handle && promoCode
      ? `/i/${encodeURIComponent(offer.influencer.handle)}/${encodeURIComponent(promoCode)}`
      : null;

  const cardBody = (
    <>
      <span className="relative block h-56 w-full bg-zinc-900">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            aria-hidden="true"
            fill
            sizes="176px"
            className="object-cover"
            unoptimized
          />
        ) : null}
      </span>
      <span className="block px-3 py-3">
        <span className="block truncate text-[1rem] font-bold text-white">{context}</span>
        {offer.offer_title ? (
          <span className="mt-1 block truncate text-[0.85rem] font-semibold text-amber-400">
            {offer.offer_title}
          </span>
        ) : null}
        {badge ? (
          <span className="mt-2 inline-block rounded-full bg-red-600 px-3 py-1.5 text-[0.72rem] font-bold text-white">
            {copied ? "Copied!" : badge}
          </span>
        ) : null}
      </span>
    </>
  );

  if (detailHref) {
    return (
      <Link
        href={detailHref}
        className="w-44 flex-none overflow-hidden rounded-2xl border border-red-500/40 text-left"
      >
        {cardBody}
      </Link>
    );
  }

  const handleTap = async () => {
    if (!promoCode) return;
    try {
      await navigator.clipboard.writeText(promoCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — nothing to fall back to; the offer is
      // still fully visible on the card.
    }
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      className="w-44 flex-none overflow-hidden rounded-2xl border border-red-500/40 text-left"
    >
      {cardBody}
    </button>
  );
}

function InfluencerOffersRow({ offers }: { offers: HomescreenInfluencerOffer[] }) {
  if (!offers.length) return null;
  return (
    <div>
      <div className="mb-3 flex w-full items-center justify-between">
        <span className="font-[family:var(--font-display)] text-[1.4rem] text-gray-900 dark:text-white">
          Offers
        </span>
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-500 dark:text-white/50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {offers.map((o) => (
          <InfluencerOfferCard key={o.id} offer={o} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Location card                                                       */
/*  The backend picks the city from lat/lng, so a visitor who never     */
/*  grants permission silently gets Houston. This is where we ask, and  */
/*  where we admit when we're showing a city that isn't theirs.         */
/* ------------------------------------------------------------------ */

function LocationCard({
  variant,
  cityName,
  onAllow,
  onDismiss,
}: {
  variant: "guest" | "registered" | "blocked" | "unsupported";
  cityName: string;
  onAllow: () => void;
  onDismiss: () => void;
}) {
  const copy = {
    guest: {
      title: "Use your location?",
      body: "We'll show what's actually happening near you instead of defaulting to Houston.",
    },
    registered: {
      title: "See what's near you ✨",
      body: "Turn on location and your Bevy follows you — real venues, real distance, right now.",
    },
    blocked: {
      title: "Location is off for Social Bevy",
      body: "Your browser is blocking location for this site, so we can't ask again. Turn it back on in site settings for nearby picks.",
    },
    unsupported: {
      title: "We're not in your area yet",
      body: `You're outside every city we cover so far — showing ${cityName} in the meantime.`,
    },
  }[variant];

  const canAllow = variant === "guest" || variant === "registered";

  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-gray-200 dark:border-white/15 bg-white/90 dark:bg-black/40 px-4 py-3">
      <span className="mt-0.5 flex-none text-red-400" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.82rem] font-semibold text-gray-900 dark:text-white">{copy.title}</p>
        <p className="mt-0.5 text-[0.72rem] leading-4 text-gray-600 dark:text-white/65">{copy.body}</p>
        <div className="mt-2 flex gap-2">
          {canAllow ? (
            <button
              type="button"
              onClick={onAllow}
              className="rounded-full border border-red-500 bg-red-600 px-3 py-1 text-[0.72rem] font-semibold text-white"
            >
              Allow
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-gray-200 dark:border-white/25 px-3 py-1 text-[0.72rem] font-semibold text-gray-700 dark:text-white/85"
          >
            {canAllow ? "Not now" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feed dispatcher                                                     */
/* ------------------------------------------------------------------ */

function FeedCard({
  item,
  onEventOpen,
  onVenueOpen,
  onOffersOpen,
  isLoggedIn,
  onRequireAuth,
  savedVenueIds,
  onToggleSaveVenue,
}: {
  item: HomeFeedItem;
  onEventOpen: (evt: UpcomingEvent) => void;
  onVenueOpen: (id: string | number) => void;
  onOffersOpen: () => void;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
  savedVenueIds: string[];
  onToggleSaveVenue: (venue: GenieVenue) => void;
}) {
  switch (item.feed_type) {
    case "event":
      return (
        <EventFeedCard
          item={item}
          onOpen={() => onEventOpen(item.raw)}
          isLoggedIn={isLoggedIn}
          onRequireAuth={onRequireAuth}
        />
      );
    case "social_post":
      return <SocialPostCard item={item} isLoggedIn={isLoggedIn} onRequireAuth={onRequireAuth} />;
    case "on_fire_venue":
      return (
        <OnFireVenueCard
          item={item}
          onViewVenue={() => onVenueOpen(item.id)}
          isSaved={savedVenueIds.includes(String(item.id))}
          isLoggedIn={isLoggedIn}
          onRequireAuth={onRequireAuth}
          onToggleSaveVenue={onToggleSaveVenue}
        />
      );
    case "suggested_producers":
      return (
        <SuggestedProducersRow
          producers={item.producers}
          isLoggedIn={isLoggedIn}
          onRequireAuth={onRequireAuth}
        />
      );
    case "neighborhood_pulse":
      return (
        <NeighborhoodPulse
          neighborhood={item.neighborhood}
          spikingCount={item.spikingCount}
          onOpen={item.topVenueId ? () => onVenueOpen(item.topVenueId as number) : undefined}
        />
      );
    case "offers":
      return (
        <OffersRow
          placements={item.placements}
          onSeeAll={onOffersOpen}
          onOpen={onVenueOpen}
        />
      );
    case "influencer_offers":
      return <InfluencerOffersRow offers={item.offers} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

// This screen is the consumer surface: every role switch navigates to that
// role's own dashboard (see RoleSwitcherDialog's onNavigateToRole), so being
// here means acting as a consumer regardless of what was last stored. The bar
// therefore states the role rather than reading it back — previously a user who
// visited their influencer dashboard and returned here still saw "Influencer".
// The control remains the way into the role switcher.
const ROLE_BAR_LABEL = "Consumer";

type HomescreenSectionProps = {
  account: ConsumerAccount | null;
  navigateTo: (screen: FlowAnchor) => void;
  onVenueOpen: (id: string | number) => void;
  onEventOpen: (evt: UpcomingEvent) => void;
  onMenuOpen: () => void;
  onOrbTap: () => void;
  onOpenRoleSwitcher?: () => void;
  onNotifications?: () => void;
  unreadNotifCount?: number;
  onMessages?: () => void;
  unreadMessageCount?: number;
  userCoords?: { latitude: number; longitude: number } | null;
  /**
   * Which location ask to surface, decided by SinglePageGenieApp from the
   * Permissions API plus the hard-denied flag. Null = nothing to ask.
   */
  locationPromptVariant?: "guest" | "registered" | "blocked" | null;
  onAllowLocation?: () => void;
  onDismissLocationPrompt?: () => void;
  savedVenueIds: string[];
  onToggleSaveVenue: (venue: GenieVenue) => void;
};

// Distance scrolled before the header is allowed to hide. Roughly its own
// height, so it doesn't slide away on the first small nudge.
const HEADER_HIDE_AFTER = 64;

export function HomescreenSection({
  account,
  navigateTo,
  onVenueOpen,
  onEventOpen,
  onMenuOpen,
  onOpenRoleSwitcher,
  onNotifications,
  unreadNotifCount,
  onMessages,
  unreadMessageCount,
  userCoords,
  locationPromptVariant,
  onAllowLocation,
  onDismissLocationPrompt,
  savedVenueIds,
  onToggleSaveVenue,
}: HomescreenSectionProps) {
  const isLoggedIn = !!account;

  // One random value per app-open, reused for every homescreen / load-more /
  // suggested-producers request this visit. The backend uses it to
  // deterministically reorder results per seed: reloading the app picks a new
  // seed (fresh mix), while "load more" during one visit reuses the same seed
  // (so pagination never repeats an item). Generated once via the lazy
  // initializer — never regenerated on re-render.
  const [shuffleSeed] = useState(() => Math.random().toString(36).slice(2));

  // Header hides while scrolling down the feed and comes back on the first
  // upward flick, so reaching it never means scrolling all the way to the top.
  const feedScrollRef = useRef<HTMLElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  const handleFeedScroll = useCallback(() => {
    const el = feedScrollRef.current;
    if (!el) {
      return;
    }

    const current = el.scrollTop;
    const delta = current - lastScrollTopRef.current;

    // Ignore sub-pixel jitter and iOS rubber-band overscroll, which otherwise
    // flip the header back and forth while the finger is still.
    if (Math.abs(delta) < 6) {
      return;
    }
    lastScrollTopRef.current = current;

    // Near the top the header always belongs on screen, regardless of direction.
    if (current <= HEADER_HIDE_AFTER) {
      setIsHeaderHidden(false);
      return;
    }

    setIsHeaderHidden(delta > 0);
  }, []);
  // Everything renders for everyone; interactions gate on auth. Guests are
  // sent to the auth screen, logged-in users proceed to the event/producer.
  const requireAuth = useCallback(() => navigateTo("account"), [navigateTo]);
  const gatedEventOpen = useCallback(
    (evt: UpcomingEvent) => (isLoggedIn ? onEventOpen(evt) : requireAuth()),
    [isLoggedIn, onEventOpen, requireAuth]
  );
  const gatedVenueOpen = useCallback(
    (id: string | number) => (isLoggedIn ? onVenueOpen(id) : requireAuth()),
    [isLoggedIn, onVenueOpen, requireAuth]
  );

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [followedProducers, setFollowedProducers] = useState<FollowedProducerItem[]>([]);

  useEffect(() => {
    if (!account?.id) {
      setFollowedProducers([]);
      return;
    }
    let cancelled = false;
    fetchFollowedProducers()
      .then((result) => {
        if (!cancelled) setFollowedProducers(result.followed_producers ?? []);
      })
      .catch(() => {
        if (!cancelled) setFollowedProducers([]);
      });
    return () => { cancelled = true; };
  }, [account?.id]);

  const [suggestedProducers, setSuggestedProducers] = useState<SuggestedProducerItem[]>([]);

  useEffect(() => {
    if (!account?.id) {
      setSuggestedProducers([]);
      return;
    }
    let cancelled = false;
    fetchSuggestedProducers({ limit: 20, shuffleSeed })
      .then((result) => {
        if (cancelled) return;
        const mapped: SuggestedProducerItem[] = (result.suggested_follows ?? []).map((p) => ({
          feed_type: "suggested_producer",
          id: p.id,
          name: (p.display_name as string) || "Producer",
          image_url: p.profile_photo_url as string | undefined,
          event_count: p.total_events_live as number | undefined,
          producer_id: p.id,
        }));
        setSuggestedProducers(mapped);
      })
      .catch(() => {
        if (!cancelled) setSuggestedProducers([]);
      });
    return () => { cancelled = true; };
  }, [account?.id, shuffleSeed]);

  // Events arrive 10 at a time; posts have to keep roughly that pace or the
  // weave below runs dry and the feed turns back into a wall of events.
  const POSTS_PER_LOAD = 3;

  const [homescreenPosts, setHomescreenPosts] = useState<SocialPostFeedItem[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);

  const toFeedItem = (pair: { post: PublicPost; author: PublicPostAuthor | null }): SocialPostFeedItem => ({
    feed_type: "social_post",
    id: pair.post.id,
    post: pair.post,
    author: pair.author,
  });

  useEffect(() => {
    let cancelled = false;
    setPostsPage(1);
    setHasMorePosts(true);
    // Guests only ever get the single curated post on page 1, so a short
    // first page correctly ends their post feed here.
    fetchHomescreenPosts(1, POSTS_PER_LOAD)
      .then((result) => {
        if (cancelled) return;
        const posts = result.posts ?? [];
        setHomescreenPosts(posts.map(toFeedItem));
        if (posts.length < POSTS_PER_LOAD) setHasMorePosts(false);
      })
      .catch(() => {
        if (!cancelled) {
          setHomescreenPosts([]);
          setHasMorePosts(false);
        }
      });
    return () => { cancelled = true; };
  }, [account?.id]);

  // ── Rails ──
  // Both rails paginate independently and offset-based off the *same*
  // location.city_id, and always advance with the server's next_offset (page
  // sizes are mixed: 6 on first load, 10 thereafter).
  const [location, setLocation] = useState<HomescreenLocation | null>(null);
  const [allEvents, setAllEvents] = useState<UpcomingEvent[]>([]);
  const [eventsOffset, setEventsOffset] = useState(0);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [venues, setVenues] = useState<TrendingVenue[]>([]);
  const [venuesOffset, setVenuesOffset] = useState(0);
  const [hasMoreVenues, setHasMoreVenues] = useState(true);
  const [influencerOffers, setInfluencerOffers] = useState<HomescreenInfluencerOffer[]>([]);
  const [offersOffset, setOffersOffset] = useState(0);
  const [hasMoreOffers, setHasMoreOffers] = useState(true);
  const [placements, setPlacements] = useState<HomescreenPlacement[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<HomescreenNeighborhood[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  // Only the very first load shows the skeleton. Granting location mid-session
  // refetches for the resolved city, and swapping content in place beats
  // collapsing the screen the visitor is already reading.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [outOfAreaDismissed, setOutOfAreaDismissed] = useState(false);
  const sentinelObserverRef = useRef<IntersectionObserver | null>(null);
  // Always-current refs read from inside the observer callback below, so the
  // observer itself never needs to be torn down and recreated when these
  // change (see sentinelCallbackRef for why that recreation was a problem).
  const loadMoreRef = useRef<() => void>(() => {});
  const hasMoreRef = useRef(false);
  // The city the currently-rendered rails belong to. Load-more responses are
  // matched against it so a city switch mid-scroll discards in-flight pages.
  const activeCityRef = useRef<number | null>(null);

  // First paint. Deliberately never blocked on the location permission: with no
  // coordinates the backend serves Houston, so the screen paints while the
  // browser prompt is still up, then refetches if/when coordinates arrive.
  const loadFirstPage = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetchHomescreen({
      userId: account?.id ?? undefined,
      lat: userCoords?.latitude,
      lng: userCoords?.longitude,
      shuffleSeed,
    })
      .then((result) => {
        if (cancelled) return;
        // Reset every rail together — a different city must not inherit the
        // previous city's offsets.
        setLocation(result.location ?? null);
        activeCityRef.current = result.location?.city_id ?? null;
        const events = result.upcoming_events;
        setAllEvents(events?.items ?? []);
        setEventsOffset(events?.next_offset ?? 0);
        setHasMoreEvents(events?.has_more ?? false);
        const rail = result.trending_venues;
        setVenues(rail?.items ?? []);
        setVenuesOffset(rail?.next_offset ?? 0);
        setHasMoreVenues(rail?.has_more ?? false);
        const offersRail = result.influencer_offers;
        setInfluencerOffers(offersRail?.items ?? []);
        setOffersOffset(offersRail?.next_offset ?? 0);
        setHasMoreOffers(offersRail?.has_more ?? false);
        setPlacements(result.active_placements ?? []);
        setNeighborhoods(result.top_neighborhoods ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Could not load feed.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setHasLoadedOnce(true);
        }
      });

    return () => { cancelled = true; };
  }, [account?.id, userCoords?.latitude, userCoords?.longitude, shuffleSeed]);

  useEffect(() => loadFirstPage(), [loadFirstPage]);

  const loadMore = useCallback(() => {
    const cityId = location?.city_id;
    if (loadingMore || !cityId) return;
    if (!hasMoreEvents && !hasMoreVenues && !hasMoreOffers && !hasMorePosts) return;
    setLoadingMore(true);

    const eventsRequest = hasMoreEvents
      ? fetchHomescreenEvents({
          cityId,
          offset: eventsOffset,
          userId: account?.id ?? undefined,
          shuffleSeed,
        })
          .then((page) => {
            // Drop a page that belongs to a city we've since moved off — a
            // load-more in flight when the city changes would otherwise splice
            // the old city's events into the new city's feed.
            if (activeCityRef.current !== cityId) return;
            setAllEvents((prev) => {
              // A live event can shift position between pages, so the same id
              // can legitimately arrive twice — dedupe rather than crash React
              // on a duplicate key. seenIds accumulates as we go so this also
              // catches duplicates *within* one page.
              const seenIds = new Set(prev.map((e) => e.id));
              const deduped: UpcomingEvent[] = [];
              for (const e of page.items ?? []) {
                if (seenIds.has(e.id)) continue;
                seenIds.add(e.id);
                deduped.push(e);
              }
              return [...prev, ...deduped];
            });
            setEventsOffset(page.next_offset);
            // Trust has_more, but never past a page that made no progress: an
            // empty page or a next_offset that didn't advance leaves the
            // sentinel on screen at the same offset, which re-fires this
            // request forever.
            setHasMoreEvents(
              page.has_more &&
                (page.items?.length ?? 0) > 0 &&
                page.next_offset > eventsOffset
            );
          })
          .catch(() => setHasMoreEvents(false))
      : Promise.resolve();

    const venuesRequest = hasMoreVenues
      ? fetchTrendingVenues({ cityId, offset: venuesOffset, shuffleSeed })
          .then((page) => {
            if (activeCityRef.current !== cityId) return;
            setVenues((prev) => {
              const seenIds = new Set(prev.map((v) => v.id));
              const deduped: TrendingVenue[] = [];
              for (const v of page.items ?? []) {
                if (seenIds.has(v.id)) continue;
                seenIds.add(v.id);
                deduped.push(v);
              }
              return [...prev, ...deduped];
            });
            setVenuesOffset(page.next_offset);
            setHasMoreVenues(
              page.has_more &&
                (page.items?.length ?? 0) > 0 &&
                page.next_offset > venuesOffset
            );
          })
          .catch(() => setHasMoreVenues(false))
      : Promise.resolve();

    const offersRequest = hasMoreOffers
      ? fetchHomescreenInfluencerOffers({ cityId, offset: offersOffset, shuffleSeed })
          .then((page) => {
            if (activeCityRef.current !== cityId) return;
            setInfluencerOffers((prev) => {
              const seenIds = new Set(prev.map((o) => o.id));
              const deduped: HomescreenInfluencerOffer[] = [];
              for (const o of page.items ?? []) {
                if (seenIds.has(o.id)) continue;
                seenIds.add(o.id);
                deduped.push(o);
              }
              return [...prev, ...deduped];
            });
            setOffersOffset(page.next_offset);
            setHasMoreOffers(
              page.has_more &&
                (page.items?.length ?? 0) > 0 &&
                page.next_offset > offersOffset
            );
          })
          .catch(() => setHasMoreOffers(false))
      : Promise.resolve();

    const postsRequest = hasMorePosts
      ? fetchHomescreenPosts(postsPage + 1, POSTS_PER_LOAD)
          .then((result) => {
            const newPosts = result.posts ?? [];
            if (newPosts.length < POSTS_PER_LOAD) setHasMorePosts(false);
            setHomescreenPosts((prev) => {
              const seenIds = new Set(prev.map((p) => p.id));
              const deduped: typeof newPosts = [];
              for (const p of newPosts) {
                if (seenIds.has(p.post.id)) continue;
                seenIds.add(p.post.id);
                deduped.push(p);
              }
              if (deduped.length === 0) setHasMorePosts(false);
              return [...prev, ...deduped.map(toFeedItem)];
            });
            setPostsPage(postsPage + 1);
          })
          .catch(() => setHasMorePosts(false))
      : Promise.resolve();

    Promise.all([eventsRequest, venuesRequest, offersRequest, postsRequest]).finally(() =>
      setLoadingMore(false)
    );
  }, [
    loadingMore,
    location?.city_id,
    hasMoreEvents,
    hasMoreVenues,
    hasMoreOffers,
    hasMorePosts,
    eventsOffset,
    venuesOffset,
    offersOffset,
    postsPage,
    account?.id,
    shuffleSeed,
  ]);

  // Keep these refs current every render so the observer callback below
  // always sees fresh values without the observer itself needing to change.
  loadMoreRef.current = loadMore;
  hasMoreRef.current = hasMoreEvents || hasMoreVenues || hasMoreOffers || hasMorePosts;

  // Callback ref instead of useRef + useEffect: the sentinel <div> only
  // exists once the loading skeleton is replaced by real content, and a
  // useEffect keyed on [loadMore, hasMoreEvents, hasMorePosts] never re-runs
  // for that mount (none of those change when `loading` flips), so the
  // observer was never attached. A callback ref fires the moment the node
  // itself mounts, regardless of what conditional rendering caused it to.
  //
  // Deps are intentionally empty: the observer is created exactly once per
  // sentinel mount and reads hasMoreRef/loadMoreRef for current state.
  // Recreating the observer on every hasMore*/loadMore change (as this used
  // to) causes IntersectionObserver.observe() to immediately re-fire its
  // "currently intersecting?" check — if the sentinel is still on-screen
  // right after a load (common before new content pushes it down), that
  // triggers another load instantly, over and over, which looks like the
  // feed never stops loading and the "you've reached the bottom" message
  // never gets a chance to render.
  const sentinelCallbackRef = useCallback((node: HTMLDivElement | null) => {
    sentinelObserverRef.current?.disconnect();
    sentinelObserverRef.current = null;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreRef.current) loadMoreRef.current();
      },
      { threshold: 0.1 }
    );
    observer.observe(node);
    sentinelObserverRef.current = observer;
  }, []);

  // ── Location messaging ──
  // A visitor who denied location and one who is genuinely out of range both
  // come back as fallback/unsupported; only the second sent coordinates, which
  // is what distance_mi being non-null tells us. The first already has the
  // permission card, so don't stack a second notice on them.
  const isOutOfArea =
    !!location &&
    location.source === "fallback" &&
    !location.supported &&
    location.distance_mi != null;
  const locationCardVariant: "guest" | "registered" | "blocked" | "unsupported" | null =
    locationPromptVariant ?? (isOutOfArea && !outOfAreaDismissed ? "unsupported" : null);
  // Label the served city whenever it wasn't chosen from the visitor's own
  // location, so a Houston feed is never silently presented as "near you".
  const showCityLabel = !!location && location.source === "fallback";

  // The pulse banner only earns its space when the top neighborhood is
  // actually spiking. The count comes from venues we've loaded — the table's
  // venue_count is the neighborhood's total, not how many are hot right now.
  const topNeighborhood = neighborhoods[0];
  const pulseNeighborhood =
    topNeighborhood && SPIKING_STATES.has(topNeighborhood.social_energy_state ?? "")
      ? topNeighborhood
      : null;
  const spikingVenues = pulseNeighborhood
    ? venues.filter(
        (v) =>
          v.neighborhood === pulseNeighborhood.name &&
          SPIKING_STATES.has(v.social_energy_state ?? "")
      )
    : [];

  // Build the feed in mockup order: lead event, neighborhood pulse, offers,
  // first post, top venue, suggested producers — then the remaining events
  // with a venue card every fourth card as both rails page in.
  const eventItems = allEvents.map(upcomingEventToFeedItem);
  const venueItems = venues.map(trendingVenueToFeedItem);
  const feed: HomeFeedItem[] = [];
  if (eventItems[0]) feed.push(eventItems[0]);
  if (pulseNeighborhood) {
    feed.push({
      feed_type: "neighborhood_pulse",
      id: pulseNeighborhood.id,
      neighborhood: pulseNeighborhood,
      spikingCount: spikingVenues.length,
      topVenueId: spikingVenues[0]?.id,
    });
  }
  if (placements.length > 0) {
    feed.push({ feed_type: "offers", id: "offers", placements });
  }
  if (homescreenPosts[0]) feed.push(homescreenPosts[0]);
  if (venueItems[0]) feed.push(venueItems[0]);
  // Suggested Producers AND Offers both reappear periodically (like
  // Instagram's "suggested for you") instead of showing once as one long
  // row — each fetched batch is sliced into groups of 4, one group per
  // appearance, with no further network calls needed to reveal the next
  // group.
  const PRODUCERS_PER_APPEARANCE = 4;
  const producerChunks: SuggestedProducerItem[][] = [];
  for (let i = 0; i < suggestedProducers.length; i += PRODUCERS_PER_APPEARANCE) {
    producerChunks.push(suggestedProducers.slice(i, i + PRODUCERS_PER_APPEARANCE));
  }
  let nextProducerChunk = 0;
  const pushProducerChunk = () => {
    const chunk = producerChunks[nextProducerChunk];
    if (!chunk || chunk.length === 0) return;
    feed.push({
      feed_type: "suggested_producers",
      id: `suggested_producers-${nextProducerChunk}`,
      producers: chunk,
    });
    nextProducerChunk += 1;
  };
  if (isLoggedIn) pushProducerChunk();

  const OFFERS_PER_APPEARANCE = 4;
  const offerChunks: HomescreenInfluencerOffer[][] = [];
  for (let i = 0; i < influencerOffers.length; i += OFFERS_PER_APPEARANCE) {
    offerChunks.push(influencerOffers.slice(i, i + OFFERS_PER_APPEARANCE));
  }
  let nextOfferChunk = 0;
  const pushOfferChunk = () => {
    const chunk = offerChunks[nextOfferChunk];
    if (!chunk || chunk.length === 0) return;
    feed.push({
      feed_type: "influencer_offers",
      id: `influencer_offers-${nextOfferChunk}`,
      offers: chunk,
    });
    nextOfferChunk += 1;
  };
  pushOfferChunk();
  // Weave the three streams rather than concatenating them. Events are the
  // spine (they're the most numerous), with a post every 2nd and a venue
  // every 3rd. This used to append `...posts.slice(1)` after the whole event
  // list, which is why the feed read as "every event, then every post".
  let nextVenue = 1;
  let nextPost = 1;
  eventItems.slice(1).forEach((evt, i) => {
    feed.push(evt);
    const position = i + 1;
    if (position % 2 === 0 && homescreenPosts[nextPost]) {
      feed.push(homescreenPosts[nextPost]);
      nextPost += 1;
    }
    if (position % 3 === 0 && venueItems[nextVenue]) {
      feed.push(venueItems[nextVenue]);
      nextVenue += 1;
    }
    if (position % 5 === 0) pushOfferChunk();
    if (position % 8 === 0) pushProducerChunk();
  });
  // The venue rail pages in faster than the cadence consumes it, so hold the
  // surplus back to be woven into the events still loading — but once the
  // event rail is exhausted, flush it so nothing loaded is silently dropped.
  if (!hasMoreEvents) {
    feed.push(...venueItems.slice(nextVenue));
    while (nextOfferChunk < offerChunks.length) pushOfferChunk();
  }
  feed.push(...homescreenPosts.slice(nextPost));

  return (
    <section
      ref={feedScrollRef}
      onScroll={handleFeedScroll}
      className="flex flex-1 flex-col overflow-y-auto pb-28"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      {/* Sticky rather than in-flow so it can slide out and back without the
          feed jumping. Background stays transparent by design. */}
      <div
        className={`sticky top-0 z-30 flex items-center justify-between px-1 py-3 transition-transform duration-200 ease-out ${
          isHeaderHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="flex flex-col items-start gap-0.5">
          {/* Speech-bubble mark — no rounded-full crop, it would clip the tail. */}
          <div className="relative h-10 w-11">
            <Image src="/icons/social-bevy-logo.png" alt="Social Bevy" fill sizes="44px" className="object-contain object-left" />
          </div>
          <button
            type="button"
            onClick={onOpenRoleSwitcher}
            aria-label={`Current role: ${ROLE_BAR_LABEL}. Switch profiles`}
            className="flex items-center gap-0.5 text-[0.7rem] font-semibold leading-none text-gray-900 transition hover:text-gray-600 dark:text-white dark:hover:text-white/80"
          >
            {ROLE_BAR_LABEL}
            <svg viewBox="0 0 24 24" className="h-3 w-3 text-red-500" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Same target as the bottom dock's centre button — both open Genie. */}
          <button
            type="button"
            aria-label="Open Genie"
            onClick={() => navigateTo("home")}
            className="relative h-9 w-9 flex-none transition hover:brightness-110 active:scale-95"
          >
            <Image src="/icons/top_bar_genie.png" alt="" aria-hidden="true" fill sizes="36px" className="object-contain" />
          </button>
          <button type="button" aria-label="Messages" onClick={onMessages} className="relative flex h-9 w-9 items-center justify-center text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            {(unreadMessageCount ?? 0) > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[0.55rem] font-bold leading-none text-white">
                {unreadMessageCount! > 9 ? "9+" : unreadMessageCount}
              </span>
            )}
          </button>
          <button type="button" aria-label="Notifications" onClick={onNotifications} className="relative flex h-9 w-9 items-center justify-center text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {(unreadNotifCount ?? 0) > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[0.55rem] font-bold leading-none text-white">
                {unreadNotifCount! > 9 ? "9+" : unreadNotifCount}
              </span>
            )}
          </button>
          <button type="button" onClick={onMenuOpen} className="flex h-9 w-9 flex-col items-center justify-center gap-[4.5px]" aria-label="Menu">
            <span className="block h-[2px] w-5 rounded-full bg-white/80" />
            <span className="block h-[2px] w-5 rounded-full bg-white/80" />
            <span className="block h-[2px] w-5 rounded-full bg-white/80" />
          </button>
        </div>
      </div>

      {/* ── Story bar ──────────────────────────────────────────────── */}
      {isLoggedIn && followedProducers.length > 0 && (
        <div className="px-1 pb-2">
          <StoryBar producers={followedProducers} />
        </div>
      )}

      {/* ── Location ask / out-of-area notice ──────────────────────── */}
      {locationCardVariant && (
        <div className="px-1 pb-3">
          <LocationCard
            variant={locationCardVariant}
            cityName={location?.city_name ?? "Houston"}
            onAllow={() => onAllowLocation?.()}
            onDismiss={() =>
              locationCardVariant === "unsupported"
                ? setOutOfAreaDismissed(true)
                : onDismissLocationPrompt?.()
            }
          />
        </div>
      )}

      {loading && !hasLoadedOnce ? (
        /* ── Skeleton ─────────────────────────────────────────────── */
        <div className="space-y-4 px-1">
          <div className="h-72 animate-pulse rounded-[18px] bg-gray-200 dark:bg-white/10" />
          <div className="h-14 animate-pulse rounded-[14px] bg-gray-200 dark:bg-white/10" />
          <div className="h-72 animate-pulse rounded-[18px] bg-gray-200 dark:bg-white/10" />
        </div>
      ) : fetchError && !hasLoadedOnce ? (
        /* ── Error ────────────────────────────────────────────────── */
        /* Only when there is nothing to show. A failed *refetch* (e.g. the
           one triggered by granting location) must not wipe a feed the
           visitor is already reading. */
        <div className="mt-16 flex flex-col items-center gap-3 px-6 text-center">
          <p className="text-[0.85rem] text-gray-400 dark:text-white/40">Could not load your feed.</p>
          <p className="text-[0.72rem] text-gray-300 dark:text-white/25">{fetchError}</p>
          <button
            type="button"
            onClick={loadFirstPage}
            className="mt-2 rounded-full border border-gray-200 dark:border-white/20 px-5 py-2 text-[0.78rem] font-semibold text-gray-600 dark:text-white/70"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="space-y-4 px-1">
          <FeaturedVideoRail />
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-[family:var(--font-display)] text-[1.4rem] text-gray-900 dark:text-white">Your Bevy</h2>
            {showCityLabel && (
              <span className="text-[0.7rem] text-gray-400 dark:text-white/40">Showing {location?.city_name}</span>
            )}
          </div>
          <div className="space-y-3">
            {feed.map((item) => (
              <FeedCard
                key={`${item.feed_type}-${item.id}`}
                item={item}
                onEventOpen={gatedEventOpen}
                onVenueOpen={gatedVenueOpen}
                onOffersOpen={() => navigateTo("offers")}
                isLoggedIn={isLoggedIn}
                onRequireAuth={requireAuth}
                savedVenueIds={savedVenueIds}
                onToggleSaveVenue={onToggleSaveVenue}
              />
            ))}
          </div>
          <div ref={sentinelCallbackRef} className="h-4" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-red-600 dark:border-white/20 dark:border-t-white" />
            </div>
          )}
          {!loadingMore && !hasMoreEvents && !hasMoreVenues && !hasMorePosts && (
            <p className="py-6 text-center text-[0.78rem] text-gray-400 dark:text-white/35">
              You&apos;ve reached the bottom — that&apos;s everything for now
            </p>
          )}
        </div>
      )}
    </section>
  );
}
