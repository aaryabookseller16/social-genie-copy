"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  fetchEventDetail,
  fetchEventOffers,
  followProducer,
  type EventDetailResponse,
  type InfluencerEventOffer,
  type VibbeeEventOffer,
} from "@/app/lib/publicApiClient";
import { readAuthToken } from "@/app/lib/localState";
import { useEventRsvp, type UserRsvpStatus } from "@/app/lib/useEventRsvp";
import ImageGallery from "@/app/components/ImageGallery";
import { mediaGalleryFor } from "@/app/lib/image";
import FeaturedEventVideos from "@/app/components/FeaturedEventVideos";

type Props = {
  eventId: number | null;
  initialData: Record<string, unknown>;
  onBack: () => void;
  onAuthRequired?: () => void;
  onRideClick?: (address: string) => void;
  logInteraction?: (action: string, id: number, screen: string) => void;
  onEventOpen?: (evt: Record<string, unknown>) => void;
};

function fmtTime(t: unknown): string {
  if (typeof t !== "string" || !t) return "";
  const parts = t.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

function fmtDate(d: unknown): string {
  if (typeof d !== "string" || !d) return "";
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

// ─── Add-to-Calendar (.ics) helpers ──────────────────────────────────────────
// Build a downloadable .ics file client-side so the event can be added to any
// device calendar (iOS / Android / desktop) without native deeplinks.

// "YYYY-MM-DD" + "HH:MM:SS" -> "YYYYMMDDTHHMMSS" (floating local time).
function toIcsStamp(dateStr: string, timeStr: string): string {
  const d = dateStr.replace(/-/g, "");
  const [h = "00", m = "00", s = "00"] = (timeStr || "00:00:00").split(":");
  const pad = (v: string) => v.padStart(2, "0").slice(0, 2);
  return `${d}T${pad(h)}${pad(m)}${pad(s)}`;
}

// Add `hours` to a "YYYYMMDDTHHMMSS" stamp (used to derive an end time when none given).
function addHoursToStamp(stamp: string, hours: number): string {
  const y = +stamp.slice(0, 4);
  const mo = +stamp.slice(4, 6);
  const da = +stamp.slice(6, 8);
  const h = +stamp.slice(9, 11);
  const mi = +stamp.slice(11, 13);
  const s = +stamp.slice(13, 15);
  const dt = new Date(y, mo - 1, da, h + hours, mi, s);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}T${p(dt.getHours())}${p(dt.getMinutes())}${p(dt.getSeconds())}`;
}

// DTSTAMP must be expressed in UTC per RFC 5545 §3.8.7.2 (trailing "Z"); a bare
// floating-time DTSTAMP is rejected outright by some clients (e.g. Windows Calendar/Outlook).
function toIcsUtcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// Escape reserved characters per RFC 5545.
function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

type CalendarEventOpts = {
  id?: number;
  title: string;
  dateStr: string;
  startTime: string;
  endTime: string;
  venueName: string;
  venueAddr: string;
};

function calendarEventFields(opts: CalendarEventOpts) {
  const dtStart = toIcsStamp(opts.dateStr, opts.startTime);
  const dtEnd = opts.endTime
    ? toIcsStamp(opts.dateStr, opts.endTime)
    : addHoursToStamp(dtStart, 2);
  const location = [opts.venueName, opts.venueAddr].filter(Boolean).join(", ");
  return { dtStart, dtEnd, location };
}

function buildEventIcs(opts: CalendarEventOpts): string {
  const { dtStart, dtEnd, location } = calendarEventFields(opts);
  const dtStamp = toIcsUtcStamp(new Date());
  const uid = `${opts.id ?? "event"}-${Date.now()}@genie.socialbevy.com`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Social Genie//Event//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(opts.title)}`,
    location ? `LOCATION:${escapeIcs(location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n") + "\r\n";
}

// "YYYYMMDDTHHMMSS" -> "YYYY-MM-DDTHH:MM:SS" (Outlook's deeplink expects this form).
function stampToIso(stamp: string): string {
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}`;
}

function buildGoogleCalendarUrl(opts: CalendarEventOpts): string {
  const { dtStart, dtEnd, location } = calendarEventFields(opts);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${dtStart}/${dtEnd}`,
  });
  if (location) params.set("location", location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookCalendarUrl(opts: CalendarEventOpts): string {
  const { dtStart, dtEnd, location } = calendarEventFields(opts);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: opts.title,
    startdt: stampToIso(dtStart),
    enddt: stampToIso(dtEnd),
  });
  if (location) params.set("location", location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// Package the .ics text as a Blob and trigger a browser download.
function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function VerifiedBadge() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-red-400" fill="currentColor" aria-label="Verified">
      <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.307 4.491 4.491 0 01-1.307-3.497A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.492 4.492 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[10px] bg-gray-200 dark:bg-white/10 ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <section className="-mx-4 -mt-3 sm:-mx-6 sm:-mt-5 pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)]">
      {/* Hero skeleton */}
      <Skeleton className="h-[55vw] min-h-[220px] max-h-[340px] w-full rounded-none" />
      <div className="flex flex-col gap-5 px-4 pt-4 sm:px-6">
        <Skeleton className="h-9 w-3/4" />
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </section>
  );
}

function ErrorState({ onBack, onRetry }: { onBack: () => void; onRetry: () => void }) {
  return (
    <section className="-mx-4 -mt-3 sm:-mx-6 sm:-mt-5 pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)]">
      <div className="flex h-[55vw] min-h-[220px] max-h-[340px] w-full items-center justify-center bg-white/90 dark:bg-black/40">
        <button type="button" onClick={onBack} className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center text-white">
          <BackIcon />
        </button>
      </div>
      <div className="flex flex-col items-center gap-4 px-4 pt-12 text-center sm:px-6">
        <p className="text-[2rem]">😕</p>
        <p className="text-[1rem] font-semibold text-gray-900 dark:text-white">Couldn&apos;t load event details</p>
        <p className="text-[0.83rem] text-gray-500 dark:text-white/55">Check your connection and try again.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-full bg-red-600 px-6 py-2.5 text-[0.85rem] font-semibold text-white hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    </section>
  );
}

function AuthRequiredState({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  return (
    <section className="-mx-4 -mt-3 sm:-mx-6 sm:-mt-5 pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)]">
      <div className="relative flex h-[55vw] min-h-[220px] max-h-[340px] w-full items-center justify-center bg-white/90 dark:bg-black/40">
        <button type="button" onClick={onBack} className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center text-white">
          <BackIcon />
        </button>
      </div>
      <div className="flex flex-col items-center gap-4 px-4 pt-12 text-center sm:px-6">
        <p className="text-[2rem]">🔒</p>
        <p className="text-[1rem] font-semibold text-gray-900 dark:text-white">Sign in to view event details</p>
        <p className="text-[0.83rem] text-gray-500 dark:text-white/55">
          Create a free account or sign in to access full event info, tickets, and more.
        </p>
        <button
          type="button"
          onClick={onLogin}
          className="mt-2 rounded-full bg-red-600 px-8 py-2.5 text-[0.85rem] font-semibold text-white hover:bg-red-700"
        >
          Sign In / Sign Up
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-[0.78rem] text-gray-400 dark:text-white/40 underline underline-offset-2"
        >
          Go back
        </button>
      </div>
    </section>
  );
}

function MiniEventCard({
  evt,
  onOpen,
}: {
  evt: { title?: string; cover_image_url?: string; category?: string };
  onOpen?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className="relative h-44 w-44 flex-none overflow-hidden rounded-[14px] text-left"
    >
      <Image
        src={evt.cover_image_url || "/sample-venue-2.jpeg"}
        alt={evt.title || "Event"}
        fill
        className="object-cover"
        sizes="176px"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="text-[0.82rem] font-semibold leading-tight text-gray-900 dark:text-white">{evt.title}</p>
        {evt.category ? (
          <p className="mt-0.5 flex items-center gap-1 text-[0.72rem] text-gray-600 dark:text-white/65">
            <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
            {evt.category}
          </p>
        ) : null}
        <span className="mt-1.5 block text-[0.72rem] font-medium text-gray-700 dark:text-white/80">
          Learn more
        </span>
      </div>
    </button>
  );
}

function isAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("401") || msg.includes("unauthorized") || msg.includes("authentication required");
}

export function EventDetailSection({ eventId, initialData, onBack, onAuthRequired, onRideClick, logInteraction, onEventOpen }: Props) {
  const [data, setData] = useState<EventDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [vibbeeOffers, setVibbeeOffers] = useState<VibbeeEventOffer[]>([]);
  const [influencerOffers, setInfluencerOffers] = useState<InfluencerEventOffer[]>([]);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const [rideError, setRideError] = useState(false);
  const calendarMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCalendarMenu) return;
    const onOutsideClick = (e: MouseEvent) => {
      if (calendarMenuRef.current && !calendarMenuRef.current.contains(e.target as Node)) {
        setShowCalendarMenu(false);
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [showCalendarMenu]);

  // Real offers (V.I.Bee house + influencer-driven) for this event. Auth-required
  // endpoint, so skip the fetch entirely for guests rather than let it 401.
  useEffect(() => {
    if (!eventId || !readAuthToken()) {
      setVibbeeOffers([]);
      setInfluencerOffers([]);
      return;
    }
    let cancelled = false;
    fetchEventOffers(eventId)
      .then((result) => {
        if (cancelled) return;
        setVibbeeOffers(result.vibbee_offers ?? []);
        setInfluencerOffers(result.influencer_offers ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setVibbeeOffers([]);
          setInfluencerOffers([]);
        }
      });
    return () => { cancelled = true; };
  }, [eventId]);

  // Seed follow state from the embedded producer once data / initialData is ready.
  // Read `is_following` from whichever source actually provides it: the event-detail
  // API may omit it, so fall back to the value embedded in the tapped event (initialData).
  useEffect(() => {
    const fromApi = (data?.producer as { is_following?: boolean } | undefined)?.is_following;
    const fromInitial = (initialData.producer as { is_following?: boolean } | undefined)?.is_following;
    setIsFollowing(fromApi ?? fromInitial ?? false);
  }, [data, initialData]);

  // Merge here (not just below the loading/error guards) because this feeds
  // useEventRsvp, which — like all hooks — must run on every render.
  // The Xano response is nested ({ event, venue, related_events, related_count }),
  // not flat — spreading `data` alone only ever overrides venue/related_events/
  // related_count (the keys that genuinely sit at the top level). Per-event
  // fields (title, going_count, user_rsvp_status, ...) live under `data.event`
  // and need spreading on top separately, or a fresh fetch never actually
  // overrides the stale tap-through initialData for any of them.
  const freshEvent = data?.event ?? {};
  const mergedEvent: Record<string, unknown> = { ...initialData, ...(data ?? {}), ...freshEvent };
  const rsvpEventId = typeof mergedEvent.id === "number" ? mergedEvent.id : null;
  const rsvp = useEventRsvp(
    rsvpEventId,
    (mergedEvent.user_rsvp_status as UserRsvpStatus | undefined) ?? null,
    Number(mergedEvent.going_count) || 0,
    Number(mergedEvent.interested_count) || 0,
    "event-detail",
    onAuthRequired
  );

  async function handleFollow(producerId?: number) {
    if (!producerId || followBusy) return;
    if (!readAuthToken()) {
      onAuthRequired?.();
      return;
    }
    setFollowBusy(true);
    const optimistic = !isFollowing;
    setIsFollowing(optimistic);
    try {
      const res = await followProducer(producerId, "event-detail");
      setIsFollowing(res.action === "followed");
    } catch {
      setIsFollowing(!optimistic);
    } finally {
      setFollowBusy(false);
    }
  }

  const load = () => {
    if (!eventId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    setAuthRequired(false);
    fetchEventDetail(eventId)
      .then((res) => { setData(res); setLoading(false); })
      .catch((err: unknown) => {
        setLoading(false);
        if (isAuthError(err)) {
          setAuthRequired(true);
        } else {
          setError(true);
        }
      });
  };

  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSkeleton />;
  if (authRequired) return <AuthRequiredState onBack={onBack} onLogin={() => onAuthRequired ? onAuthRequired() : onBack()} />;
  if (error)   return <ErrorState onBack={onBack} onRetry={load} />;

  // Merge: real API data takes priority, fall back to initialData for any missing field
  const ev = mergedEvent;

  const evTitle    = (ev.title as string) || "Event";
  const coverImg   = (ev.cover_image_url as string) || "/sample-venue-1.jpeg";
  // Photos lead, video(s) follow — one carousel. Falls back to a single implicit
  // image when the event has no cover, gallery, or video at all.
  const heroMediaRaw = mediaGalleryFor(ev.cover_image_url, ev.image_urls, ev.video_urls);
  const heroMedia = heroMediaRaw.length > 0 ? heroMediaRaw : [{ type: "image" as const, url: coverImg }];
  const startT     = fmtTime(ev.start_time);
  const endT       = fmtTime(ev.end_time);
  const dateStr    = fmtDate(ev.event_date);
  const venueName  = (ev.venue_name as string) || "";
  const venueAddr  = (ev.venue_address as string) || "";
  // `ev.venue` is the full genie_venues row nested in the ep_get_event_detail_dev
  // response (see mergedEvent above) — the flat venue_name/venue_address fields
  // it's spread from don't carry coordinates.
  const venueRecord = ev.venue as Record<string, unknown> | undefined;
  const venueLat = typeof venueRecord?.latitude === "number" ? venueRecord.latitude : null;
  const venueLng = typeof venueRecord?.longitude === "number" ? venueRecord.longitude : null;
  const description = (ev.description as string) || "";
  const category   = (ev.category as string) || (ev.event_category as string) || "";
  const producer   = ev.producer as { id?: number; name?: string; image_url?: string; event_count?: number; is_verified?: boolean; is_following?: boolean } | undefined;
  const producerId = producer?.id ?? (ev.producer_id as number | undefined);
  const ticketUrl  = ev.ticket_url as string | undefined;
  const isFree     = ev.is_free === true;
  const ticketHref = ticketUrl || (ev.public_slug ? `/events/${ev.public_slug as string}` : null);
  const ticketLabel = ticketUrl ? "Buy Tickets" : isFree ? "RSVP – Free" : ticketHref ? "Get Tickets" : "Tickets Unavailable";
  const mapAddr    = venueAddr || venueName || "Houston, TX";
  const relatedEvents = (ev.related_events as Record<string, unknown>[]) ?? [];
  const venueEvents   = (ev.venue_events   as Record<string, unknown>[]) ?? [];

  return (
    <section className="-mx-4 -mt-3 sm:-mx-6 sm:-mt-5 pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)]">

      {/* ── Hero ── */}
      <div className="relative h-[55vw] min-h-[220px] max-h-[340px] w-full flex-none overflow-hidden">
        <ImageGallery items={heroMedia} alt={evTitle} className="absolute inset-0" heightClass="h-full" showThumbnails={false} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#1a0202] via-[#1a0202]/55 to-transparent" />

        {/* Back */}
        <button
          type="button"
          onClick={onBack}
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center text-white"
          aria-label="Go back"
        >
          <BackIcon />
        </button>

        {/* Heart + Calendar */}
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!readAuthToken()) { onAuthRequired?.(); return; }
              logInteraction?.(isSaved ? "unsave" : "save", ev.id as number, "event-detail");
              setIsSaved((v) => !v);
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/30 backdrop-blur-sm ${isSaved ? "text-red-500" : "text-white"}`}
            aria-label={isSaved ? "Unsave event" : "Save event"}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
          <div className="relative" ref={calendarMenuRef}>
            <button
              type="button"
              onClick={() => {
                const dateStr = (ev.event_date as string) || "";
                if (!dateStr) return; // need a date for a valid calendar entry
                setShowCalendarMenu((v) => !v);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white backdrop-blur-sm"
              aria-label="Add to calendar"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" />
              </svg>
            </button>
            {showCalendarMenu && (() => {
              const calOpts = {
                id: ev.id as number | undefined,
                title: evTitle,
                dateStr: (ev.event_date as string) || "",
                startTime: (ev.start_time as string) || "",
                endTime: (ev.end_time as string) || "",
                venueName,
                venueAddr,
              };
              const finish = () => {
                logInteraction?.("add_to_calendar", ev.id as number, "event-detail");
                setShowCalendarMenu(false);
              };
              return (
                <div className="absolute right-0 top-11 z-10 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-lg backdrop-blur-md dark:border-white/15 dark:bg-black/80 dark:text-white">
                  <button
                    type="button"
                    onClick={() => {
                      window.open(buildGoogleCalendarUrl(calOpts), "_blank", "noopener,noreferrer");
                      finish();
                    }}
                    className="flex w-full items-center px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/10"
                  >
                    Google Calendar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.open(buildOutlookCalendarUrl(calOpts), "_blank", "noopener,noreferrer");
                      finish();
                    }}
                    className="flex w-full items-center px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/10"
                  >
                    Outlook.com
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const ics = buildEventIcs(calOpts);
                      const safeName =
                        evTitle.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "event";
                      downloadIcs(`${safeName}.ics`, ics);
                      finish();
                    }}
                    className="flex w-full items-center px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/10"
                  >
                    Apple / Other (.ics)
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-col">

      {/* ── Top block on red gradient (title + meta + CTAs) ── */}
      <div className="flex flex-col gap-5 bg-gradient-to-b from-[#1a0202] via-[#2a0606] to-transparent px-4 pb-8 pt-4 sm:px-6">

        {/* Title */}
        <h1 className="text-[1.85rem] font-bold leading-tight text-gray-900 dark:text-white">{evTitle}</h1>

        {/* Meta */}
        <div className="flex flex-col gap-2.5">
          {(startT || dateStr) ? (
            <div className="flex items-center gap-2 text-[0.82rem] text-gray-600 dark:text-white/75">
              <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-gray-500 dark:text-white/50" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>
                {startT && endT ? `${startT} – ${endT}` : startT}
                {dateStr ? (startT ? ` • ${dateStr}` : dateStr) : ""}
              </span>
            </div>
          ) : null}

          {venueName ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-gray-500 dark:text-white/50" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                <span className="text-[0.82rem] font-semibold text-gray-900 dark:text-white">{venueName}</span>
              </div>
              {venueAddr ? <p className="pl-6 text-[0.78rem] text-gray-500 dark:text-white/55">{venueAddr}</p> : null}
            </div>
          ) : null}

          {(category || producer?.name) ? (
            <div className="flex items-center gap-4 text-[0.82rem] text-gray-600 dark:text-white/75">
              {category ? (
                <span className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                  {category}
                </span>
              ) : null}
              {producer?.name ? (
                <span className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  {producer.name}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ── Going / Interested ── */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={rsvp.busy || !rsvpEventId}
            onClick={() => {
              void rsvp.setRsvp("going");
              logInteraction?.("going", (ev.id as number) ?? 0, "event-detail");
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-[0.8rem] font-semibold transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-60 ${
              rsvp.status === "going"
                ? "bg-white text-[#1a0202]"
                : "border border-gray-300 dark:border-white/30 bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white"
            }`}
          >
            {rsvp.status === "going" ? "✓ Going" : "Going"}
            {rsvp.goingCount > 0 ? <span className="opacity-70">· {rsvp.goingCount}</span> : null}
          </button>
          <button
            type="button"
            disabled={rsvp.busy || !rsvpEventId}
            onClick={() => {
              void rsvp.setRsvp("interested");
              logInteraction?.("interested", (ev.id as number) ?? 0, "event-detail");
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-[0.8rem] font-semibold transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-60 ${
              rsvp.status === "interested"
                ? "bg-white text-[#1a0202]"
                : "border border-gray-300 dark:border-white/30 bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white"
            }`}
          >
            {rsvp.status === "interested" ? "✓ Interested" : "Interested"}
            {rsvp.interestedCount > 0 ? <span className="opacity-70">· {rsvp.interestedCount}</span> : null}
          </button>
        </div>

        {/* ── CTAs: Buy Tickets | Ride | Share ── */}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!ticketHref}
            onClick={() => {
              if (ticketHref) window.open(ticketHref, "_blank", "noopener,noreferrer");
              logInteraction?.("ticket_click", ev.id as number, "event-detail");
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-red-600 px-3 py-2.5 text-[0.8rem] font-semibold text-white transition-transform hover:bg-red-700 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            </svg>
            {ticketLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              // Only a lat/lng dropoff reliably preselects in Uber — a
              // formatted-address-only link routinely opens with nothing
              // preselected. Without coordinates, fail loudly instead of
              // shipping that broken experience.
              if (venueLat == null || venueLng == null) {
                console.log("[ride_click] no venue coordinates available", {
                  event_id: ev.id,
                  venue_name: venueName,
                  venue_address: venueAddr,
                });
                setRideError(true);
                window.setTimeout(() => setRideError(false), 4000);
                return;
              }
              const addr = venueAddr || venueName || "Houston, TX";
              onRideClick?.(addr);
              window.open(
                `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${venueLat}&dropoff[longitude]=${venueLng}&dropoff[nickname]=${encodeURIComponent(venueName || addr)}&dropoff[formatted_address]=${encodeURIComponent(addr)}`,
                "_blank",
                "noopener,noreferrer"
              );
              logInteraction?.("ride_click", ev.id as number, "event-detail");
            }}
            className="flex flex-none items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-[0.8rem] font-medium text-gray-700 backdrop-blur-sm transition-transform hover:bg-gray-50 active:scale-95 dark:border-white/25 dark:bg-black/30 dark:text-white dark:hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v2" />
              <circle cx="9" cy="20" r="1" /><circle cx="19" cy="20" r="1" />
              <path d="M14 17H9M19 17h2a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-4" />
            </svg>
            Ride
          </button>
          <button
            type="button"
            onClick={() => {
              const t = ev.title as string;
              const u = ticketUrl ?? window.location.href;
              if (navigator.share) { void navigator.share({ title: t, url: u }); }
              else { void navigator.clipboard.writeText(u); }
              logInteraction?.("share", ev.id as number, "event-detail");
            }}
            className="flex flex-none items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-[0.8rem] font-medium text-gray-700 backdrop-blur-sm transition-transform hover:bg-gray-50 active:scale-95 dark:border-white/25 dark:bg-black/30 dark:text-white dark:hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
        </div>

      </div>

      {/* ── Remaining sections ── */}
      <div className="flex flex-col gap-5 px-4 pt-1 sm:px-6">

        {/* ── Offers (V.I.Bee house + influencer-driven), only rendered when real ones exist ── */}
        {vibbeeOffers.length + influencerOffers.length > 0 ? (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
            {vibbeeOffers.map((offer) => (
              <div key={`vibbee-${offer.id}`} className="w-[85vw] max-w-72 flex-none rounded-[14px] border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-black/30 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[0.9rem] font-semibold text-gray-900 dark:text-white">V.I.Bee Offer</span>
                  {offer.offer_type ? (
                    <span className="flex-none rounded-full bg-red-600 px-2.5 py-0.5 text-[0.65rem] font-bold text-white">
                      {offer.offer_type}
                    </span>
                  ) : null}
                </div>
                {offer.offer_title ? (
                  <p className="mt-1.5 text-[0.88rem] font-semibold text-red-400">{offer.offer_title}</p>
                ) : null}
                {offer.offer_description ? (
                  <p className="mt-1 text-[0.78rem] leading-5 text-gray-500 dark:text-white/60">{offer.offer_description}</p>
                ) : null}
              </div>
            ))}
            {influencerOffers.map((offer) => {
              const card = (
                <div className="w-[85vw] max-w-72 flex-none rounded-[14px] border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-black/30 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[0.9rem] font-semibold text-gray-900 dark:text-white">
                      {offer.influencer_handle ? `Offer from @${offer.influencer_handle}` : "Influencer Offer"}
                    </span>
                    {offer.offer_type ? (
                      <span className="flex-none rounded-full bg-red-600 px-2.5 py-0.5 text-[0.65rem] font-bold text-white">
                        {offer.offer_type}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[0.88rem] font-semibold text-red-400">{offer.offer_title}</p>
                  {offer.offer_description ? (
                    <p className="mt-1 text-[0.78rem] leading-5 text-gray-500 dark:text-white/60">{offer.offer_description}</p>
                  ) : null}
                </div>
              );
              return offer.influencer_handle ? (
                <a key={`influencer-${offer.id}`} href={`/i/${offer.influencer_handle}`} className="block flex-none">
                  {card}
                </a>
              ) : (
                <div key={`influencer-${offer.id}`} className="flex-none">{card}</div>
              );
            })}
          </div>
        ) : null}

        {/* ── Event Details ── */}
        {description ? (
          <div>
            <h3 className="mb-2 text-[1rem] font-semibold text-gray-900 dark:text-white">Event Details</h3>
            <p className="line-clamp-5 text-[0.83rem] leading-6 text-gray-600 dark:text-white/65">{description}</p>
            {ev.public_slug && description.length > 240 ? (
              <button
                type="button"
                onClick={() =>
                  window.open(`/events/${ev.public_slug as string}`, "_blank", "noopener,noreferrer")
                }
                className="mt-1 text-[0.8rem] font-medium text-red-400"
              >
                Read more...
              </button>
            ) : null}
          </div>
        ) : null}

        {/* ── Featured Videos ── */}
        <FeaturedEventVideos videos={ev.video_urls as { url: string; thumbnail_url: string }[] | undefined} eventTitle={evTitle} />

        {/* ── Event Location ── */}
        <div>
          <h3 className="mb-3 text-[1rem] font-semibold text-gray-900 dark:text-white">Event Location</h3>
          <div className="relative h-44 w-full overflow-hidden rounded-[14px] border border-gray-200 dark:border-white/10">
            <iframe
              title={`Map – ${venueName || evTitle}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(mapAddr)}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0"
              allowFullScreen
            />
          </div>
          {venueAddr ? <p className="mt-2 text-[0.85rem] text-gray-600 dark:text-white/75">{venueAddr}</p> : null}
        </div>

        {/* ── Event Producers ── */}
        {producer?.name ? (
          <div>
            <h3 className="mb-3 text-[1rem] font-semibold text-gray-900 dark:text-white">Event Producers</h3>
            <div className="flex items-center gap-3">
              {producerId ? (
                <a href={`/p/${producerId}`} aria-label={`View ${producer.name ?? "producer"} profile`} className="h-12 w-12 flex-none overflow-hidden rounded-full border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-black/40">
                  {producer.image_url ? (
                    <Image src={producer.image_url} alt={producer.name ?? "Producer"} width={48} height={48} className="h-12 w-12 object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center bg-red-900/50 text-[0.7rem] font-bold text-white/70">
                      {(producer.name ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </a>
              ) : (
                <div className="h-12 w-12 flex-none overflow-hidden rounded-full border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-black/40">
                  {producer.image_url ? (
                    <Image src={producer.image_url} alt={producer.name ?? "Producer"} width={48} height={48} className="h-12 w-12 object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center bg-red-900/50 text-[0.7rem] font-bold text-white/70">
                      {(producer.name ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  {producerId ? (
                    <a href={`/p/${producerId}`} className="flex items-center gap-1 text-[0.9rem] font-semibold text-gray-900 hover:text-red-600 dark:text-white dark:hover:text-red-300">
                      {producer.name}
                      {producer.is_verified ? <VerifiedBadge /> : null}
                    </a>
                  ) : (
                    <span className="flex items-center gap-1 text-[0.9rem] font-semibold text-gray-900 dark:text-white">
                      {producer.name}
                      {producer.is_verified ? <VerifiedBadge /> : null}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleFollow(producerId)}
                    disabled={followBusy || !producerId}
                    className={`rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold transition disabled:opacity-60 ${
                      isFollowing
                        ? "border border-red-500 bg-transparent text-red-400"
                        : "bg-red-600 text-white hover:bg-red-500"
                    }`}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                </div>
                <p className="flex items-center gap-1 text-[0.75rem] text-gray-500 dark:text-white/55">
                  <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                  {category || "Events"}
                </p>
                {producer.event_count ? (
                  <p className="text-[0.72rem] text-red-400">
                    {producer.event_count} upcoming event{producer.event_count === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* ── More like this ── */}
        {relatedEvents.length > 0 ? (
          <div>
            <h3 className="mb-3 text-[1rem] font-semibold text-gray-900 dark:text-white">More like this</h3>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
              {relatedEvents.map((evt) => (
                <MiniEventCard
                  key={evt.id as number}
                  evt={evt as { title?: string; cover_image_url?: string; category?: string }}
                  onOpen={onEventOpen ? () => onEventOpen(evt) : undefined}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* ── Also in this venue ── */}
        {venueEvents.length > 0 ? (
          <div>
            <h3 className="mb-3 text-[1rem] font-semibold text-gray-900 dark:text-white">Also in this venue</h3>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
              {venueEvents.map((evt) => (
                <MiniEventCard
                  key={evt.id as number}
                  evt={evt as { title?: string; cover_image_url?: string; category?: string }}
                  onOpen={onEventOpen ? () => onEventOpen(evt) : undefined}
                />
              ))}
            </div>
          </div>
        ) : null}

      </div>
      </div>

      {rideError ? (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] z-50 mx-auto max-w-sm rounded-xl bg-gray-900 px-4 py-3 text-center text-[0.82rem] font-medium text-white shadow-lg dark:bg-black">
          Ride directions aren&apos;t available for this location yet.
        </div>
      ) : null}
    </section>
  );
}
