"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { type ConsumerAccount } from "@/app/lib/localState";
import {
  fetchEventsFeed,
  fetchPastEvents,
  fetchSavedEvents,
  rsvpToEvent,
  submitEventSurvey,
  type ManagedEvent,
} from "@/app/lib/publicApiClient";
import { computeDistance, getDistanceLabel } from "@/app/lib/geo";
import { BackIcon } from "@/app/components/single-page/ui";

type EventsTab = "upcoming" | "liked" | "past";

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

function formatEventDate(raw?: string): string {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      weekday: "long",
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
  if (Number.isNaN(hour)) return "";
  const period = hour >= 12 ? "PM" : "AM";
  const hr12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hr12}:${m ?? "00"} ${period}`;
}

function eventDateTimeLabel(evt: ManagedEvent): string {
  return [formatEventDate(evt.event_date), formatEventTime(evt.start_time)].filter(Boolean).join(", ");
}

function eventLocationLabel(evt: ManagedEvent): string {
  return [evt.venue_name, evt.neighborhood || evt.city].filter(Boolean).join(", ");
}

/* ------------------------------------------------------------------ */
/*  Small UI bits                                                      */
/* ------------------------------------------------------------------ */

function StarRow({
  value,
  onSelect,
  size = "h-3.5 w-3.5",
}: {
  value: number;
  onSelect?: (n: number) => void;
  size?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onSelect}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(n);
          }}
          className={onSelect ? "cursor-pointer" : "cursor-default"}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
        >
          <svg viewBox="0 0 20 20" className={size} aria-hidden="true">
            <path
              d="M10 1.5l2.59 5.25 5.79.84-4.19 4.08.99 5.77L10 14.77l-5.18 2.67.99-5.77L1.62 7.59l5.79-.84L10 1.5z"
              fill={n <= value ? "#f59e0b" : "none"}
              stroke={n <= value ? "#f59e0b" : "currentColor"}
              strokeWidth={n <= value ? 0 : 1.3}
              className={n <= value ? "" : "text-gray-300 dark:text-white/25"}
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

function EventsEmptyIcon() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#E7070380] bg-black/5 text-red-600 dark:bg-black/20 dark:text-white">
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
        <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" stroke="currentColor" strokeWidth="1.8" />
        <line x1="7.5" y1="3" x2="7.5" y2="6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="16.5" y1="3" x2="16.5" y2="6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function EmptyState({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[20px] border border-white/10 bg-black/5 px-4 py-10 text-center dark:bg-black/20">
      <EventsEmptyIcon />
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
      {subtitle ? <p className="max-w-xs text-xs text-gray-600 dark:text-white/60">{subtitle}</p> : null}
      {action}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[20px] border border-red-200 bg-red-50 px-4 py-8 text-center dark:border-[#6a1d1d] dark:bg-black/20">
      <p className="text-sm font-semibold text-red-700 dark:text-[#ff9d7d]">Couldn&apos;t load events</p>
      <p className="max-w-xs text-xs text-gray-600 dark:text-white/60">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white"
      >
        Retry
      </button>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex gap-3 rounded-[20px] border border-white/10 bg-black/5 p-3 dark:bg-black/20">
      <div className="h-28 w-28 flex-none animate-pulse rounded-2xl bg-black/10 dark:bg-white/10" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 w-3/4 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rating modal                                                       */
/* ------------------------------------------------------------------ */

function RateEventModal({
  event,
  onClose,
  onSubmitted,
}: {
  event: ManagedEvent;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitEventSurvey({ event_id: event.id, did_attend: true, vibe_rating: rating });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit rating.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-[24px] bg-white p-5 dark:bg-[#1a0a0a] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-[1.05rem] font-semibold text-gray-900 dark:text-white">
          How was {event.title}?
        </p>
        <p className="mt-1 text-center text-xs text-gray-500 dark:text-white/60">
          Tap a star to rate your experience
        </p>
        <div className="mt-4 flex justify-center">
          <StarRow value={rating} onSelect={setRating} size="h-8 w-8" />
        </div>
        {error ? <p className="mt-3 text-center text-xs text-red-600 dark:text-[#ff9d7d]">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 dark:border-white/15 dark:text-white/80"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={rating === 0 || submitting}
            className="flex-1 rounded-full bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Event card                                                         */
/* ------------------------------------------------------------------ */

function EventCard({
  evt,
  tab,
  distanceLabel,
  busy,
  onOpen,
  onToggleLike,
  onRateNow,
}: {
  evt: ManagedEvent;
  tab: EventsTab;
  distanceLabel: string | null;
  busy: boolean;
  onOpen: () => void;
  onToggleLike?: () => void;
  onRateNow?: () => void;
}) {
  const isLiked = tab === "liked" || evt.user_rsvp_status === "saved";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full overflow-hidden rounded-[20px] border border-red-200 bg-white text-left shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition hover:shadow-[0_10px_26px_rgba(0,0,0,0.1)] dark:border-[#6a1d1d] dark:bg-black/30 dark:shadow-[0_18px_40px_rgba(0,0,0,0.4)] dark:hover:border-[#ff7b7b]"
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-28 w-28 flex-none overflow-hidden rounded-2xl">
          <Image
            src={evt.cover_image_url || "/sample-venue-1.jpeg"}
            alt={evt.title}
            fill
            className="object-cover"
            sizes="112px"
          />
        </div>

        <div className="min-w-0 flex-1 py-1">
          <p className="truncate text-[1.05rem] font-semibold leading-tight text-gray-900 dark:text-white">
            {evt.title}
          </p>
          <p className="mt-1 truncate text-[0.8rem] font-medium text-red-500 dark:text-[#ff9d7d]">
            {eventDateTimeLabel(evt)}
          </p>
          <p className="mt-1 flex items-center gap-1 truncate text-[0.78rem] text-gray-500 dark:text-white/60">
            <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" fill="currentColor" aria-hidden="true">
              <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>
            <span className="truncate">{eventLocationLabel(evt)}</span>
            {distanceLabel ? <span className="flex-none text-gray-400 dark:text-white/40"> · {distanceLabel}</span> : null}
          </p>

          <div className="mt-2 flex items-center justify-between">
            {tab === "past" ? (
              <StarRow value={evt.user_has_rated ? 5 : 0} />
            ) : (
              <span />
            )}

            {tab === "liked" ? (
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike?.();
                }}
                aria-label={isLiked ? "Unlike event" : "Like event"}
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-red-50 disabled:opacity-50 dark:bg-white/10"
              >
                <Image
                  src={isLiked ? "/icons/saved_filled.png" : "/icons/saved_oulined.png"}
                  alt=""
                  aria-hidden="true"
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 object-contain"
                />
              </button>
            ) : tab === "past" ? (
              evt.user_has_rated ? (
                <span className="text-[0.72rem] font-medium text-gray-400 dark:text-white/40">Rated</span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRateNow?.();
                  }}
                  className="text-[0.72rem] font-semibold text-red-600 dark:text-[#ff9d7d]"
                >
                  Rate Now
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab list (fetch + infinite scroll + tab-specific actions)          */
/* ------------------------------------------------------------------ */

const PER_PAGE = 10;

function EventsList({
  tab,
  account,
  userCoords,
  onSelectEvent,
}: {
  tab: EventsTab;
  account: ConsumerAccount | null;
  userCoords?: { lat: number; lng: number } | null;
  onSelectEvent: (evt: ManagedEvent) => void;
}) {
  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [ratingEvent, setRatingEvent] = useState<ManagedEvent | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadMoreRef = useRef<() => void>(() => {});
  const hasMoreRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchPage = useCallback(
    (pageNum: number) => {
      if (tab === "upcoming") return fetchEventsFeed(pageNum, PER_PAGE);
      if (tab === "liked") return fetchSavedEvents(pageNum, PER_PAGE);
      return fetchPastEvents(pageNum, PER_PAGE);
    },
    [tab]
  );

  // Sorts one freshly-fetched batch in place (distance-first, then
  // newest-created-first). Applied once per batch, not to the whole
  // accumulated list — re-sorting everything on every load-more would
  // reshuffle cards the user has already scrolled past, making newly
  // loaded events pop up above/among what's already on screen instead of
  // appending below it where the user actually is.
  const sortBatch = useCallback(
    (batch: ManagedEvent[]) => {
      if (tab !== "upcoming") return batch;
      const withDistance = batch.map((evt) => ({
        evt,
        distance:
          userCoords && typeof evt.venue_latitude === "number" && typeof evt.venue_longitude === "number"
            ? computeDistance(userCoords.lat, userCoords.lng, evt.venue_latitude, evt.venue_longitude, false)
            : null,
        createdAt: typeof evt.created_at === "number" ? evt.created_at : 0,
      }));
      withDistance.sort((a, b) => {
        if (a.distance == null && b.distance == null) return b.createdAt - a.createdAt;
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      });
      return withDistance.map((d) => d.evt);
    },
    [tab, userCoords]
  );

  useEffect(() => {
    if ((tab === "liked" || tab === "past") && !account) {
      setEvents([]);
      setLoading(false);
      setError(null);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setEvents([]);
    setPage(1);
    setHasMore(true);

    fetchPage(1)
      .then((result) => {
        if (cancelled) return;
        const list = result.events ?? [];
        setEvents(sortBatch(list));
        if (list.length < PER_PAGE) setHasMore(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load events.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sortBatch intentionally excluded: it's only applied to the freshly-fetched batch here, not re-run against already-rendered events when userCoords changes mid-scroll.
  }, [tab, account, fetchPage, reloadToken]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPage(page + 1)
      .then((result) => {
        const newEvents = result.events ?? [];
        if (newEvents.length < PER_PAGE) setHasMore(false);
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id));
          const deduped = newEvents.filter((e) => !seen.has(e.id));
          if (deduped.length === 0) setHasMore(false);
          return [...prev, ...sortBatch(deduped)];
        });
        setPage((p) => p + 1);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same reasoning as above; sortBatch is only applied to the new page's batch.
  }, [loadingMore, hasMore, fetchPage, page]);

  loadMoreRef.current = loadMore;
  hasMoreRef.current = hasMore;

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreRef.current) loadMoreRef.current();
      },
      { threshold: 0.1 }
    );
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  const setBusy = (id: number, isBusy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleToggleLike = async (evt: ManagedEvent) => {
    if (busyIds.has(evt.id)) return;
    setBusy(evt.id, true);
    const prevEvents = events;
    setEvents((prev) => prev.filter((e) => e.id !== evt.id));
    try {
      await rsvpToEvent(evt.id, "removed", "events-page-liked-tab");
    } catch {
      setEvents(prevEvents);
    } finally {
      setBusy(evt.id, false);
    }
  };

  if (!account && (tab === "liked" || tab === "past")) {
    return (
      <EmptyState
        title={tab === "liked" ? "Sign in to see events you've liked" : "Sign in to see your past events"}
        subtitle="Create a free account to like events and keep track of what you've been to."
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => setReloadToken((t) => t + 1)} />;
  }

  if (events.length === 0) {
    const copy =
      tab === "upcoming"
        ? { title: "No upcoming events near you yet", subtitle: "Check back soon — new events are added all the time." }
        : tab === "liked"
          ? { title: "You haven't liked any events yet", subtitle: "Tap the heart on any event to save it here." }
          : { title: "No past events yet", subtitle: "Events you've attended will show up here after they happen." };
    return <EmptyState title={copy.title} subtitle={copy.subtitle} />;
  }

  return (
    <>
      <p className="mb-3 text-sm font-medium text-gray-500 dark:text-white/60">
        {events.length} Event{events.length === 1 ? "" : "s"}
      </p>
      <div className="space-y-3">
        {events.map((evt) => (
          <EventCard
            key={evt.id}
            evt={evt}
            tab={tab}
            distanceLabel={tab === "upcoming" ? getDistanceLabel(userCoords, evt.venue_latitude, evt.venue_longitude) : null}
            busy={busyIds.has(evt.id)}
            onOpen={() => onSelectEvent(evt)}
            onToggleLike={tab === "liked" ? () => handleToggleLike(evt) : undefined}
            onRateNow={tab === "past" ? () => setRatingEvent(evt) : undefined}
          />
        ))}
      </div>

      {loadingMore ? (
        <div className="mt-3 space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : null}

      {hasMore ? (
        <div ref={sentinelRef} className="h-8" />
      ) : (
        <p className="pt-4 text-center text-xs text-gray-400 dark:text-white/40">No more events</p>
      )}

      {ratingEvent ? (
        <RateEventModal
          event={ratingEvent}
          onClose={() => setRatingEvent(null)}
          onSubmitted={() => {
            setEvents((prev) => prev.map((e) => (e.id === ratingEvent.id ? { ...e, user_has_rated: true } : e)));
            setRatingEvent(null);
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page shell                                                         */
/* ------------------------------------------------------------------ */

export default function EventsPage({
  account,
  userCoords,
  onBack,
  onSelectEvent,
}: {
  account: ConsumerAccount | null;
  userCoords?: { lat: number; lng: number } | null;
  onBack: () => void;
  onSelectEvent: (evt: ManagedEvent) => void;
}) {
  const [tab, setTab] = useState<EventsTab>("upcoming");

  return (
    <section className="pb-28">
      <div className="mb-5 flex items-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82"
        >
          <BackIcon size={20} />
        </button>
        <h2 className="flex-1 pr-9 text-center font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
          Manage Events
        </h2>
      </div>

      <div className="mb-4 flex items-center gap-1 rounded-full border border-red-200 bg-white/70 p-1 dark:border-white/10 dark:bg-black/24">
        {([
          { id: "upcoming", label: "Upcoming" },
          { id: "liked", label: "Liked" },
          { id: "past", label: "Past" },
        ] as { id: EventsTab; label: string }[]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-red-600 text-white shadow-[0_6px_16px_rgba(230,20,20,0.35)]"
                : "text-gray-500 dark:text-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <EventsList key={tab} tab={tab} account={account} userCoords={userCoords} onSelectEvent={onSelectEvent} />
    </section>
  );
}
