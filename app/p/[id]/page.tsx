"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ScrollUnlock } from "./ScrollUnlock";
import {
  fetchProducerPublicProfile,
  fetchProducerPosts,
  followProducer,
  type ProducerPublicPageData,
  type ProducerEvent,
  type ProducerPost,
} from "@/app/lib/publicApiClient";
import { readAuthToken } from "@/app/lib/localState";
import { mediaGalleryFor } from "@/app/lib/image";
import ImageGallery from "@/app/components/ImageGallery";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEventDate(raw?: string): string {
  if (!raw) return "";
  const [y, m, d] = raw.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat dark:bg-[url('/bg.png')]">
      <ScrollUnlock />
      <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/55 dark:block" />
      <div className="relative z-10 h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-red-600 dark:border-white/20 dark:border-t-white" />
    </main>
  );
}

function NotFoundScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat dark:bg-[url('/bg.png')] px-6 text-center">
      <ScrollUnlock />
      <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/55 dark:block" />
      <div className="relative z-10">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Producer not found</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-white/50">This profile doesn&apos;t exist or is no longer active.</p>
        <a
          href="/"
          className="mt-5 inline-block rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500"
        >
          Go Home
        </a>
      </div>
    </main>
  );
}

function EventCard({ ev, initials, displayName }: { ev: ProducerEvent; initials: string; displayName: string }) {
  // `going_count` reflects actual attendees; `rsvp_count` counts RSVP
  // actions (including cancellations) and only ever increases, so it's
  // kept only as a fallback for events written before going_count existed.
  const goingCount = ev.going_count ?? ev.rsvp_count ?? 0;

  // `/?screen=event&event_id=X` opens the SPA's full in-app event-detail
  // screen (RSVP, going count, follow, related events) from this standalone
  // page — works for every event since it only needs the numeric id, unlike
  // the public slug microsite which only exists for events with a generated
  // public_slug.
  const href = `/?screen=event&event_id=${ev.id}`;

  return (
    <a href={href} className="block overflow-hidden rounded-[22px] border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-black/30">
      {/* Author row */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-red-500/40 bg-red-900 text-[0.55rem] font-bold text-white">
            {initials}
          </div>
          <div>
            <p className="text-[0.78rem] font-semibold text-gray-900 dark:text-white">{displayName}</p>
            {ev.event_date ? (
              <p className="text-[0.65rem] text-gray-400 dark:text-white/40">{formatEventDate(ev.event_date)}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Event title as post text */}
      <p className="mt-2.5 px-4 text-[0.88rem] leading-5 text-gray-700 dark:text-white/85">{ev.title}</p>

      {/* Cover image */}
      {ev.cover_image_url ? (
        <div className="relative mt-3 h-52 w-full">
          <Image
            src={ev.cover_image_url}
            alt={ev.title}
            fill
            className="object-cover"
            sizes="(max-width: 448px) 100vw, 448px"
            unoptimized
          />
        </div>
      ) : (
        <div className="mx-4 mt-3 flex h-32 items-center justify-center rounded-xl bg-red-950/30">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-300 dark:text-white/15" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="m3 9 4-4 4 4 5-5 5 5" />
            <circle cx="8.5" cy="13.5" r="1.5" />
          </svg>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-4 pt-3">
        {ev.venue_name ? (
          <div className="flex items-center gap-1.5 text-[0.72rem] text-gray-400 dark:text-white/45">
            <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {ev.venue_name}
          </div>
        ) : null}

        <div className="mt-2.5 border-t border-gray-200 dark:border-white/10 pt-2.5">
          {goingCount > 0 ? (
            <p className="text-[0.72rem] text-gray-400 dark:text-white/45">View all {goingCount} going</p>
          ) : null}
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[0.72rem] text-gray-300 dark:text-white/30">
              {ev.is_free ? "Free event" : ev.ticket_price_min ? `From $${ev.ticket_price_min}` : ""}
            </span>
            <span className="text-[0.72rem] font-semibold text-red-400">View event</span>
          </div>
        </div>
      </div>
    </a>
  );
}

function PostCard({ post, initials, displayName }: { post: ProducerPost; initials: string; displayName: string }) {
  const media = mediaGalleryFor(post.image_url, post.image_urls, post.video_urls);

  return (
    <a
      href={`/posts/${post.id}`}
      className="block overflow-hidden rounded-[22px] border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-black/30"
    >
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-red-500/40 bg-red-900 text-[0.55rem] font-bold text-white">
          {initials}
        </div>
        <div>
          <p className="text-[0.78rem] font-semibold text-gray-900 dark:text-white">{displayName}</p>
          <p className="text-[0.65rem] text-gray-400 dark:text-white/40">{formatShortRelativeTime(post.created_at)}</p>
        </div>
      </div>

      {post.post_text ? (
        <p className="mt-2.5 px-4 text-[0.88rem] leading-5 text-gray-700 dark:text-white/85">{post.post_text}</p>
      ) : null}

      {media.length > 0 ? (
        <div className="mt-3">
          <ImageGallery items={media} alt={post.post_text ?? "Post"} heightClass="h-52" showThumbnails={false} />
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between border-t border-gray-200 dark:border-white/10 px-4 py-2.5">
        <span className="text-[0.72rem] text-gray-400 dark:text-white/45">
          {post.like_count ? `${post.like_count} like${post.like_count === 1 ? "" : "s"}` : "Like"}
          {post.comment_count ? ` · ${post.comment_count} comment${post.comment_count === 1 ? "" : "s"}` : ""}
        </span>
        <span className="text-[0.72rem] font-semibold text-red-400">View post</span>
      </div>
    </a>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProducerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ProducerPublicPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [posts, setPosts] = useState<ProducerPost[]>([]);

  useEffect(() => {
    const token = readAuthToken();
    if (!token) {
      router.replace(`/?screen=login&redirect=/p/${id}`);
      return;
    }
    fetchProducerPublicProfile(Number(id))
      .then((d) => {
        if (!d?.producer) {
          setNotFound(true);
          return;
        }
        setData(d);
        setIsFollowing(d.is_following ?? false);
      })
      .catch(() => {
        // If token was wiped by a 401, send back to login
        if (!readAuthToken()) {
          router.replace(`/?screen=login&redirect=/p/${id}`);
        } else {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));

    fetchProducerPosts(Number(id))
      .then((r) => setPosts(r.posts ?? []))
      .catch(() => setPosts([]));
  }, [id, router]);

  async function handleFollow() {
    if (!data?.producer.id || followBusy) return;
    setFollowBusy(true);
    const optimistic = !isFollowing;
    setIsFollowing(optimistic);
    try {
      const res = await followProducer(data.producer.id, "profile");
      setIsFollowing(res.action === "followed");
    } catch {
      setIsFollowing(!optimistic);
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (notFound || !data) return <NotFoundScreen />;

  const { producer, upcoming_events } = data;

  const displayName = producer.display_name ?? "Producer";
  const initials = displayName.slice(0, 2).toUpperCase();
  const followerCount = producer.follower_count ?? 0;
  const totalEvents = producer.total_events_created ?? data.event_count ?? 0;

  // Extract a clean website display string
  const websiteDisplay = producer.website_url
    ? producer.website_url.replace(/^https?:\/\//, "")
    : null;

  const stats = [
    { value: totalEvents, label: "Events" },
    { value: "—", label: "Check-Ins" },
    { value: followerCount.toLocaleString(), label: "Followers" },
    { value: "—", label: "Following" },
  ];

  return (
    <main className="min-h-dvh bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat dark:bg-[url('/bg.png')]">
      <ScrollUnlock />
      <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/55 dark:block" />

      <div className="relative z-10 mx-auto max-w-md px-4 pb-16 pt-14">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between">
          <a href="/" aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Profile</h1>
          <button type="button" aria-label="More options" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </div>

        {/* ── Profile row ─────────────────────────────────────────────── */}
        <div className="mb-3 flex items-start gap-4">
          {/* Avatar */}
          <div className="relative h-20 w-20 flex-none overflow-hidden rounded-full border-2 border-red-500 shadow-[0_0_18px_rgba(220,38,38,0.45)]">
            {producer.profile_photo_url ? (
              <Image
                src={producer.profile_photo_url}
                alt={displayName}
                fill
                className="object-cover"
                sizes="80px"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-red-900 text-xl font-bold text-white">
                {initials}
              </div>
            )}
          </div>

          {/* Name + verified + bio + link */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold leading-tight text-gray-900 dark:text-white">{displayName}</h2>
              {producer.is_verified ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-red-400" fill="currentColor">
                  <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.307 4.491 4.491 0 01-1.307-3.497A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.492 4.492 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                </svg>
              ) : null}
            </div>

            {producer.bio?.trim() ? (
              <p className="mt-1 text-[0.82rem] leading-5 text-gray-500 dark:text-white/60">{producer.bio.trim()}</p>
            ) : null}

            {websiteDisplay ? (
              <a
                href={producer.website_url!.startsWith("http") ? producer.website_url! : `https://${producer.website_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-[0.82rem] text-red-400 hover:text-red-300"
              >
                {websiteDisplay}
              </a>
            ) : producer.instagram_url ? (
              <a
                href={producer.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-[0.82rem] text-red-400 hover:text-red-300"
              >
                {producer.instagram_url.replace(/.*instagram\.com\//i, "").replace(/\/$/, "")}
              </a>
            ) : null}
          </div>
        </div>

        {/* ── Followed by ─────────────────────────────────────────────── */}
        {followerCount > 0 ? (
          <p className="mb-4 text-[0.82rem] text-gray-500 dark:text-white/50">
            Followed by {followerCount.toLocaleString()} {followerCount === 1 ? "person" : "people"}
          </p>
        ) : null}

        {/* ── Action buttons ──────────────────────────────────────────── */}
        <div className="mb-6 flex gap-3">
          <button
            type="button"
            onClick={() => void handleFollow()}
            disabled={followBusy}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
              isFollowing
                ? "border border-red-500 bg-transparent text-red-600 dark:text-red-400"
                : "bg-red-600 text-white hover:bg-red-500"
            }`}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
            onClick={() =>
              router.push(
                `/?screen=conversation&thread_type=producer&producer_id=${producer.id}&counterpart_name=${encodeURIComponent(displayName)}`
              )
            }
          >
            Message
          </button>
        </div>

        {/* ── Stats row — 4 boxes ─────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-4 gap-2">
          {stats.map(({ value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center rounded-[14px] border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-black/40 py-3"
            >
              <span className="text-[1rem] font-bold text-gray-900 dark:text-white">{value}</span>
              <span className="mt-0.5 text-[0.58rem] text-gray-400 dark:text-white/45">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Events feed ─────────────────────────────────────────────── */}
        <h3 className="mb-3 text-[0.95rem] font-bold text-gray-900 dark:text-white">Events</h3>
        {upcoming_events.length > 0 ? (
          <div className="space-y-3">
            {upcoming_events.map((ev) => (
              <EventCard
                key={ev.id}
                ev={ev}
                initials={initials}
                displayName={displayName}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-black/20 px-4 py-10 text-center">
            <p className="text-[0.85rem] text-gray-400 dark:text-white/35">No upcoming events</p>
          </div>
        )}

        {/* ── Posts feed ───────────────────────────────────────────────── */}
        <h3 className="mb-3 mt-6 text-[0.95rem] font-bold text-gray-900 dark:text-white">Posts</h3>
        {posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} initials={initials} displayName={displayName} />
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-black/20 px-4 py-10 text-center">
            <p className="text-[0.85rem] text-gray-400 dark:text-white/35">No posts yet</p>
          </div>
        )}

      </div>
    </main>
  );
}
