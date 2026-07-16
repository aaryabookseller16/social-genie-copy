"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

import { type ConsumerAccount } from "@/app/lib/localState";
import {
  fetchFollowedProducers,
  fetchHomescreen,
  fetchHomescreenPosts,
  fetchSuggestedProducers,
  followProducer,
  type EventFeedItem,
  type FollowedProducerItem,
  type OnFireVenueItem,
  type PublicPost,
  type PublicPostAuthor,
  type SuggestedProducerItem,
  type TrendingVenue,
  type UpcomingEvent,
} from "@/app/lib/publicApiClient";
import { mediaGalleryFor } from "@/app/lib/image";
import ImageGallery from "@/app/components/ImageGallery";
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

function upcomingEventToFeedItem(evt: UpcomingEvent, index: number): EventFeedItem {
  // Producer is embedded in each event by ep_get_homescreen_dev. Read the
  // fields defensively so we tolerate the exact Xano naming.
  const p = evt.producer;
  const name = p?.name ?? p?.display_name;
  const producer = p && name
    ? {
        name,
        image_url: p.image_url ?? p.profile_photo_url,
        event_count: p.event_count ?? p.total_events_live,
        producer_id: p.id ?? evt.producer_id,
        is_verified: p.is_verified,
        is_following: p.is_following,
      }
    : undefined;
  return {
    feed_type: "event",
    id: evt.id,
    title: evt.title,
    venue_name: evt.venue_name,
    start_time: evt.start_time,
    event_date: formatEventDate(evt.event_date),
    cover_image_url: evt.cover_image_url,
    going_count: evt.going_count ?? evt.rsvp_count,
    people_you_know: evt.people_you_know as number | undefined,
    is_on_fire: evt.is_on_fire ?? index === 0,
    badge: index === 0 ? "Happening Tonight" : undefined,
    producer_id: evt.producer_id,
    producer,
    reason: "Based on your social preferences",
    raw: evt,
  };
}

function trendingVenueToFeedItem(v: TrendingVenue): OnFireVenueItem {
  return {
    feed_type: "on_fire_venue",
    id: typeof v.id === "number" ? v.id : Number(v.id),
    venue_name: v.venue_name,
    venue_address: v.address,
    venue_latitude: v.latitude,
    venue_longitude: v.longitude,
    neighborhood: v.neighborhood_text ?? v.area_neighborhood ?? v.neighborhood,
    category: v.venue_type,
    going_count: v.sb_going_count ?? v.going_count,
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
type HomeFeedItem =
  | EventFeedItem
  | SocialPostFeedItem
  | OnFireVenueItem
  | SuggestedProducersFeedItem;

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
            <span className="block rounded-full bg-black p-[2px]">
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
          <span className="w-full truncate text-center text-[0.62rem] text-white/70">
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
        isFollowing ? "border-red-500 bg-red-600 text-white" : "border-white/30 text-white"
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
  const [saved, setSaved] = useState(false);
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
  const handleSave = () => {
    if (!isLoggedIn) return onRequireAuth();
    setSaved((v) => !v);
  };

  return (
    <div className="overflow-hidden rounded-[18px] bg-black/40">
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
      </button>

      {/* Details */}
      <div className="px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOpen} className="text-left">
            <h3 className="text-[1rem] font-bold leading-snug text-white">{item.title}</h3>
          </button>
          <button
            type="button"
            aria-label={saved ? "Unsave" : "Save"}
            onClick={handleSave}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-white/25"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 ${saved ? "text-red-500" : "text-white/80"}`}
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
            {item.venue_name ? (
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none text-red-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                <span className="text-[0.78rem] text-white/70">{item.venue_name}</span>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {item.start_time ? (
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none text-red-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="text-[0.78rem] text-white/70">{formatEventTime(item.start_time)} - Late</span>
                </div>
              ) : null}
              {item.event_date ? (
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none text-red-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="text-[0.78rem] text-white/70">{item.event_date}</span>
                </div>
              ) : null}
            </div>
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
        </button>

        {producer ? (
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
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
              <ProducerAvatar name={producer.name} />
              <div className="min-w-0">
                <p className="truncate text-[0.78rem] font-semibold text-white">{producer.name}</p>
                <p className="text-[0.62rem] text-white/50">
                  Suggested{producer.event_count ? ` · ${producer.event_count} events this month` : ""}
                </p>
              </div>
            </a>
            <FollowButton isFollowing={follow.isFollowing} followBusy={follow.followBusy} onClick={handleFollow} />
          </div>
        ) : null}

        {item.reason ? (
          <p className="mt-2.5 text-center text-[0.65rem] text-white/40">{item.reason}</p>
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
    <div className="overflow-hidden rounded-[18px] bg-black/40">
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
            <p className="text-[0.78rem] font-semibold text-white">{authorName}</p>
            <p className="text-[0.65rem] text-white/50">{formatShortRelativeTime(post.created_at)}</p>
          </div>
        </div>
        {post.post_text ? (
          <p className="mt-2 px-3 text-[0.82rem] leading-5 text-white/80">{post.post_text}</p>
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
          className="flex items-center justify-between border-t border-white/10 pt-2"
        >
          <span className="text-[0.72rem] text-white/50">
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

function OnFireVenueCard({ item, onViewVenue }: { item: OnFireVenueItem; onViewVenue: () => void }) {
  function handleGetRide() {
    const addr = item.venue_address || item.venue_name;
    const hasCoords = item.venue_latitude != null && item.venue_longitude != null;
    const coordParams = hasCoords
      ? `&dropoff[latitude]=${item.venue_latitude}&dropoff[longitude]=${item.venue_longitude}`
      : "";
    window.open(
      `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[nickname]=${encodeURIComponent(item.venue_name)}${coordParams}&dropoff[formatted_address]=${encodeURIComponent(addr)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }
  return (
    <div className="overflow-hidden rounded-[18px] bg-gradient-to-br from-red-950/70 to-black/50 px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-yellow-400">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />ON FIRE
        </span>
        {(item.neighborhood || item.category) ? (
          <span className="text-[0.65rem] text-white/50">{[item.neighborhood, item.category].filter(Boolean).join(" · ")}</span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-start justify-between">
        <div>
          <h3 className="text-[1.1rem] font-bold text-white">{item.venue_name}</h3>
          {item.badge ? (
            <span className="mt-1 inline-block rounded-full bg-black/40 px-2 py-0.5 text-[0.6rem] font-medium text-white/80">
              {item.badge}
            </span>
          ) : null}
        </div>
        {item.going_count ? (
          <div className="text-right">
            <p className="text-[1.1rem] font-bold leading-none text-white">{item.going_count}</p>
            <p className="text-[0.6rem] text-white/50">Going</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[0.55rem] font-bold text-white">
              🔥 ON FIRE
            </span>
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
    <div className="overflow-hidden rounded-[18px] bg-black/40">
      <p className="px-4 pt-3.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white/40">
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
          <ProducerAvatar name={item.name} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[0.82rem] font-semibold text-white">{item.name}</p>
            <p className="text-[0.65rem] text-white/50">
              Suggested{item.event_count ? ` · ${item.event_count} events this month` : ""}
            </p>
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
/*  Feed dispatcher                                                     */
/* ------------------------------------------------------------------ */

function FeedCard({
  item,
  onEventOpen,
  onVenueOpen,
  isLoggedIn,
  onRequireAuth,
}: {
  item: HomeFeedItem;
  onEventOpen: (evt: UpcomingEvent) => void;
  onVenueOpen: (id: string | number) => void;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
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
      return <OnFireVenueCard item={item} onViewVenue={() => onVenueOpen(item.id)} />;
    case "suggested_producers":
      return (
        <SuggestedProducersRow
          producers={item.producers}
          isLoggedIn={isLoggedIn}
          onRequireAuth={onRequireAuth}
        />
      );
    default:
      return null;
  }
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
  onNotifications?: () => void;
  unreadNotifCount?: number;
  onMessages?: () => void;
  unreadMessageCount?: number;
  userCoords?: { latitude: number; longitude: number } | null;
};

export function HomescreenSection({
  account,
  navigateTo,
  onVenueOpen,
  onEventOpen,
  onMenuOpen,
  onNotifications,
  unreadNotifCount,
  onMessages,
  unreadMessageCount,
  userCoords,
}: HomescreenSectionProps) {
  const isLoggedIn = !!account;
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
    fetchSuggestedProducers()
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
  }, [account?.id]);

  const POSTS_PER_LOAD = 2;

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
    fetchHomescreenPosts(1, 1)
      .then((result) => {
        if (cancelled) return;
        const posts = result.posts ?? [];
        setHomescreenPosts(posts.map(toFeedItem));
        if (posts.length < 1) setHasMorePosts(false);
      })
      .catch(() => {
        if (!cancelled) {
          setHomescreenPosts([]);
          setHasMorePosts(false);
        }
      });
    return () => { cancelled = true; };
  }, [account?.id]);

  const [allEvents, setAllEvents] = useState<UpcomingEvent[]>([]);
  const [eventsPage, setEventsPage] = useState(1);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [topTrendingVenue, setTopTrendingVenue] = useState<TrendingVenue | null>(null);
  const sentinelObserverRef = useRef<IntersectionObserver | null>(null);
  // Always-current refs read from inside the observer callback below, so the
  // observer itself never needs to be torn down and recreated when these
  // change (see sentinelCallbackRef for why that recreation was a problem).
  const loadMoreRef = useRef<() => void>(() => {});
  const hasMoreRef = useRef(false);

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
          const events = result.upcoming_events ?? [];
          setAllEvents(events);
          if (events.length < 5) setHasMoreEvents(false);
          setTopTrendingVenue(result.trending_venues?.[0] ?? null);
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

  const loadMore = useCallback(() => {
    if (loadingMore || (!hasMoreEvents && !hasMorePosts)) return;
    setLoadingMore(true);

    const eventsRequest = hasMoreEvents
      ? fetchHomescreen({
          cityId,
          cityName,
          userId: account?.id ?? undefined,
          lat: userCoords?.latitude,
          lng: userCoords?.longitude,
          page: eventsPage + 1,
        })
          .then((result) => {
            const newEvents = result.upcoming_events ?? [];
            if (newEvents.length < 5) setHasMoreEvents(false);
            setAllEvents((prev) => {
              // The backend's page param doesn't always exclude already-served
              // events (seen live: the same event reappeared on a later page,
              // which crashes React with a duplicate list key) — dedupe here
              // regardless of why. seenIds accumulates as we go so this also
              // catches duplicates *within* a single page response, not just
              // across pages. An all-duplicate page counts as the end.
              const seenIds = new Set(prev.map((e) => e.id));
              const deduped: typeof newEvents = [];
              for (const e of newEvents) {
                if (seenIds.has(e.id)) continue;
                seenIds.add(e.id);
                deduped.push(e);
              }
              if (deduped.length === 0) setHasMoreEvents(false);
              return [...prev, ...deduped];
            });
            setEventsPage(eventsPage + 1);
          })
          .catch(() => setHasMoreEvents(false))
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

    Promise.all([eventsRequest, postsRequest]).finally(() => setLoadingMore(false));
  }, [
    loadingMore,
    hasMoreEvents,
    hasMorePosts,
    eventsPage,
    postsPage,
    account?.id,
    userCoords?.latitude,
    userCoords?.longitude,
  ]);

  // Keep these refs current every render so the observer callback below
  // always sees fresh values without the observer itself needing to change.
  loadMoreRef.current = loadMore;
  hasMoreRef.current = hasMoreEvents || hasMorePosts;

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

  // Build the feed: the first event + first post lead, then on-fire venue /
  // suggested producers, then every subsequently loaded event and post
  // appended in load order as the visitor scrolls.
  const eventItems = allEvents.map((evt, i) => upcomingEventToFeedItem(evt, i));
  const feed: HomeFeedItem[] = [];
  if (eventItems[0]) feed.push(eventItems[0]);
  if (homescreenPosts[0]) feed.push(homescreenPosts[0]);
  if (topTrendingVenue) {
    feed.push(trendingVenueToFeedItem(topTrendingVenue));
  }
  if (isLoggedIn && suggestedProducers.length > 0) {
    feed.push({ feed_type: "suggested_producers", id: "suggested_producers", producers: suggestedProducers });
  }
  feed.push(...eventItems.slice(1), ...homescreenPosts.slice(1));

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
          <button type="button" aria-label="Messages" onClick={onMessages} className="relative flex h-9 w-9 items-center justify-center text-white/70 hover:text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            {(unreadMessageCount ?? 0) > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[0.55rem] font-bold leading-none text-white">
                {unreadMessageCount! > 9 ? "9+" : unreadMessageCount}
              </span>
            )}
          </button>
          <button type="button" aria-label="Notifications" onClick={onNotifications} className="relative flex h-9 w-9 items-center justify-center text-white/70 hover:text-white">
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

      {loading ? (
        /* ── Skeleton ─────────────────────────────────────────────── */
        <div className="space-y-4 px-1">
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
            onClick={() => { setLoading(true); setFetchError(null); fetchHomescreen({ cityId: 1, cityName: "Houston", userId: account?.id ?? undefined }).then((r) => setAllEvents(r.upcoming_events ?? [])).catch((e: unknown) => setFetchError(e instanceof Error ? e.message : "Error")).finally(() => setLoading(false)); }}
            className="mt-2 rounded-full border border-white/20 px-5 py-2 text-[0.78rem] font-semibold text-white/70"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="space-y-4 px-1">
          <h2 className="font-[family:var(--font-display)] text-[1.4rem] text-white">Your Bevy</h2>
          <div className="space-y-3">
            {feed.map((item) => (
              <FeedCard
                key={`${item.feed_type}-${item.id}`}
                item={item}
                onEventOpen={gatedEventOpen}
                onVenueOpen={gatedVenueOpen}
                isLoggedIn={isLoggedIn}
                onRequireAuth={requireAuth}
              />
            ))}
          </div>
          <div ref={sentinelCallbackRef} className="h-4" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          )}
          {!loadingMore && !hasMoreEvents && !hasMorePosts && (
            <p className="py-6 text-center text-[0.78rem] text-white/35">
              You&apos;ve reached the bottom — that&apos;s everything for now
            </p>
          )}
        </div>
      )}
    </section>
  );
}
