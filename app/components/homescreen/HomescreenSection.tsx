"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { type ConsumerAccount } from "@/app/lib/localState";
import {
  fetchFollowedProducers,
  fetchHomescreen,
  fetchSuggestedProducers,
  followProducer,
  type EventFeedItem,
  type FollowedProducerItem,
  type OnFireVenueItem,
  type SocialEnergyAlertItem,
  type SocialPostItem,
  type SuggestedProducerItem,
  type TrendingVenue,
  type UpcomingEvent,
} from "@/app/lib/publicApiClient";
import { type FlowAnchor } from "@/app/components/single-page/ui";

/* ------------------------------------------------------------------ */
/*  Dummy data                                                         */
/*  Event cards and the story bar (followed producers) use live API    */
/*  data. Everything else below is still hardcoded so the screen       */
/*  matches the Figma; swap for API fields later (field names chosen   */
/*  to mirror a future backend response).                              */
/* ------------------------------------------------------------------ */

type FeaturedVideo = { id: number; video_url: string; poster_url: string; title: string };

const DUMMY_FEATURED_VIDEOS: FeaturedVideo[] = [
  {
    id: 1,
    video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    poster_url: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&q=70",
    title: "Live at NRG",
  },
  {
    id: 2,
    video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    poster_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=70",
    title: "Midtown Nights",
  },
  {
    id: 3,
    video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    poster_url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=70",
    title: "Weekend Vibes",
  },
];

type OfferData = {
  id: number;
  venue_name: string;
  image_url: string;
  offer_text: string;
  badge: string;
};

const DUMMY_OFFERS: OfferData[] = [
  {
    id: 1,
    venue_name: "Brennan's Houston",
    image_url: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&q=70",
    offer_text: "20% off on all drinks",
    badge: "Happy Hour",
  },
  {
    id: 2,
    venue_name: "Eden Lounge",
    image_url: "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=400&q=70",
    offer_text: "20% off on every tab",
    badge: "Craft Drinks",
  },
  {
    id: 3,
    venue_name: "Club Noir",
    image_url: "https://images.unsplash.com/photo-1571204829887-3b8d69e4094d?w=400&q=70",
    offer_text: "Waived Cover",
    badge: "Late Night",
  },
];

const DUMMY_ENERGY_ALERT: SocialEnergyAlertItem = {
  feed_type: "social_energy_alert",
  id: -1,
  message: "Midtown just hit on fire - three venues spiking right now.",
};

const DUMMY_SOCIAL_POST: SocialPostItem = {
  feed_type: "social_post",
  id: -2,
  author_name: "Alphonso Roundtree",
  time_ago: "7h",
  body: "The festival was dope, I can't wait to go back... great job Social Bevy!",
  image_url: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&q=70",
  comment_count: 136,
};

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
    neighborhood: v.neighborhood_text ?? v.area_neighborhood ?? v.neighborhood,
    category: v.venue_type,
    going_count: v.sb_going_count ?? v.going_count,
  };
}

/* Local feed items that also carry a standalone row of multiple cards. */
type OffersFeedItem = { feed_type: "offers"; id: string; offers: OfferData[] };
type SuggestedProducersFeedItem = {
  feed_type: "suggested_producers";
  id: string;
  producers: SuggestedProducerItem[];
};
type HomeFeedItem =
  | EventFeedItem
  | SocialEnergyAlertItem
  | SocialPostItem
  | OnFireVenueItem
  | OffersFeedItem
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
/*  Featured videos                                                     */
/* ------------------------------------------------------------------ */

function FeaturedVideoCard({ video, wide }: { video: FeaturedVideo; wide: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  return (
    <div className={`relative ${wide ? "w-52" : "w-44"} h-64 flex-none overflow-hidden rounded-[16px] bg-zinc-900`}>
      <video
        ref={videoRef}
        src={video.video_url}
        poster={video.poster_url}
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        onEnded={() => setPlaying(false)}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="absolute inset-0 flex items-end justify-start p-3"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </span>
      </button>
      <span className="pointer-events-none absolute bottom-3 right-3 text-right text-[0.72rem] font-semibold text-white drop-shadow">
        {video.title}
      </span>
    </div>
  );
}

function FeaturedVideos({ videos }: { videos: FeaturedVideo[] }) {
  if (!videos.length) return null;
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {videos.map((v, i) => (
        <FeaturedVideoCard key={v.id} video={v} wide={i === 0} />
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
/*  Energy alert banner                                                */
/* ------------------------------------------------------------------ */

function EnergyAlertBanner({ item }: { item: SocialEnergyAlertItem }) {
  const parts = item.message.split("on fire");
  return (
    <div className="flex items-center justify-between rounded-[14px] bg-gradient-to-r from-red-900/60 to-black/40 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-red-600 text-[0.7rem]">🔥</span>
        <p className="text-[0.82rem] leading-5 text-white/85">
          {parts[0]}
          {parts.length > 1 ? <span className="font-semibold text-red-400">on fire</span> : null}
          {parts[1]}
        </p>
      </div>
      <svg viewBox="0 0 24 24" className="ml-3 h-4 w-4 flex-none text-white/50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Offers row                                                          */
/* ------------------------------------------------------------------ */

function OffersRow({ offers }: { offers: OfferData[] }) {
  if (!offers.length) return null;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family:var(--font-display)] text-[1.4rem] text-white">Offers</h2>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {offers.map((o) => (
          <div key={o.id} className="w-40 flex-none overflow-hidden rounded-[16px] bg-black/40">
            <div className="relative h-24 w-full bg-zinc-900">
              <Image src={o.image_url} alt={o.venue_name} fill sizes="160px" className="object-cover" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-1.5 left-2 right-2 truncate text-[0.72rem] font-semibold text-white drop-shadow">
                {o.venue_name}
              </span>
            </div>
            <div className="px-2.5 py-2.5">
              <p className="text-[0.68rem] text-white/60">{o.offer_text}</p>
              <span className="mt-1.5 inline-block rounded-full bg-red-600 px-2 py-0.5 text-[0.58rem] font-bold text-white">
                {o.badge}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Social post card                                                   */
/* ------------------------------------------------------------------ */

function SocialPostCard({ item }: { item: SocialPostItem }) {
  return (
    <div className="overflow-hidden rounded-[18px] bg-black/40">
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex items-center gap-2">
          <ProducerAvatar name={item.author_name} size={32} />
          <div>
            <p className="text-[0.78rem] font-semibold text-white">Social Bevy</p>
            <p className="text-[0.65rem] text-white/50">{item.author_name} · {item.time_ago}</p>
          </div>
        </div>
        <button type="button" aria-label="More" className="px-1 text-white/50">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
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

/* ------------------------------------------------------------------ */
/*  On-fire venue card                                                 */
/* ------------------------------------------------------------------ */

function OnFireVenueCard({ item, onViewVenue }: { item: OnFireVenueItem; onViewVenue: () => void }) {
  function handleGetRide() {
    const query = item.venue_address || item.venue_name;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
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
    case "social_energy_alert":
      return <EnergyAlertBanner item={item} />;
    case "social_post":
      return <SocialPostCard item={item} />;
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
    case "offers":
      return <OffersRow offers={item.offers} />;
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

  const [allEvents, setAllEvents] = useState<UpcomingEvent[]>([]);
  const [eventsPage, setEventsPage] = useState(1);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [topTrendingVenue, setTopTrendingVenue] = useState<TrendingVenue | null>(null);
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

  // Build the interleaved feed: real events mixed with the dummy Figma cards.
  const eventItems = allEvents.map((evt, i) => upcomingEventToFeedItem(evt, i));
  const feed: HomeFeedItem[] = [];
  if (eventItems[0]) feed.push(eventItems[0]);
  feed.push(DUMMY_ENERGY_ALERT);
  feed.push({ feed_type: "offers", id: "offers", offers: DUMMY_OFFERS });
  feed.push(DUMMY_SOCIAL_POST);
  if (topTrendingVenue) {
    feed.push(trendingVenueToFeedItem(topTrendingVenue));
  }
  if (isLoggedIn && suggestedProducers.length > 0) {
    feed.push({ feed_type: "suggested_producers", id: "suggested_producers", producers: suggestedProducers });
  }
  feed.push(...eventItems.slice(1));

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

      {/* ── Featured (videos) ──────────────────────────────────────── */}
      <div className="px-1 pb-2">
        <h2 className="mb-3 font-[family:var(--font-display)] text-[1.4rem] text-white">Featured</h2>
        <FeaturedVideos videos={DUMMY_FEATURED_VIDEOS} />
      </div>

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
      )}
    </section>
  );
}
