"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BackIcon, ResultCard } from "@/app/components/single-page/ui";
import { nearbyVenueToGenieVenue } from "@/app/lib/genieMappers";
import {
  fetchNearbyVenues,
  fetchSavedVenues,
  type NearbyVenue,
  type NearbyVenuesResponse,
} from "@/app/lib/publicApiClient";
import { type GenieVenue } from "@/app/lib/genieTypes";

type VenuesTab = "explore" | "saved";

/** Downtown Houston — the explicit stand-in when we have no fix on the user. */
const HOUSTON = { lat: 29.7604, lng: -95.3698 };

/** What we ask Xano for. The server may widen it — compare `radius_used_m`. */
const REQUESTED_RADIUS_M = 5000;
const PAGE_SIZE = 20;

type Meta = Pick<
  NearbyVenuesResponse,
  "fallback" | "city_name" | "radius_used_m"
> | null;

type LoadedState = {
  key: string;
  venues: NearbyVenue[];
  meta: Meta;
  nextOffset: number;
  hasMore: boolean;
  error: string | null;
  /** A "load more" page failed — offer a retry instead of ending the list. */
  loadMoreFailed: boolean;
};

/**
 * Survives the unmount that happens when the user opens a venue's detail
 * screen, so coming back restores every page they'd scrolled through and their
 * position in the list rather than refetching page 1 (~3 s) from the top.
 *
 * Module scope on purpose: this is a session cache, not component state. It is
 * keyed by the search it belongs to, so a change of coordinates ignores it.
 */
let sessionCache: (LoadedState & { scrollTop: number }) | null = null;

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-3 rounded-[18px] border border-gray-200 bg-white/90 px-4 py-3 dark:border-white/15 dark:bg-black/40">
      <span className="mt-0.5 flex-none text-red-600 dark:text-red-400" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </span>
      <p className="min-w-0 flex-1 text-[0.76rem] leading-5 text-gray-600 dark:text-white/75">{children}</p>
    </div>
  );
}

function VenueSkeleton() {
  return (
    <div className="flex gap-3 rounded-[20px] border border-gray-200 bg-white/80 p-3 dark:border-white/10 dark:bg-black/20">
      <div className="h-28 w-28 flex-none animate-pulse rounded-2xl bg-gray-200 dark:bg-white/10" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
      </div>
    </div>
  );
}

function ExploreVenuesList({
  userCoords,
  onSelectVenue,
  onAllowLocation,
  isLoggedIn,
  onRequireAuth,
  savedVenueIds,
  onToggleSaveVenue,
}: {
  userCoords?: { lat: number; lng: number } | null;
  onSelectVenue: (venueId: number) => void;
  onAllowLocation?: () => void;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
  savedVenueIds: string[];
  onToggleSaveVenue: (venue: GenieVenue) => void;
}) {
  // No fix means we search Houston *explicitly* and say so — silently serving
  // Houston to someone who declined location looks like we ignored them.
  const hasFix = !!userCoords;
  const lat = userCoords?.lat ?? HOUSTON.lat;
  const lng = userCoords?.lng ?? HOUSTON.lng;

  // Bumped by "Try again" to re-run the load effect on unchanged coordinates.
  const [reloadKey, setReloadKey] = useState(0);
  // Identifies the search the state below belongs to. Loading is derived from
  // it rather than set synchronously in the effect, so switching coordinates
  // shows the skeleton again without a cascading render.
  const requestKey = `${lat},${lng},${reloadKey}`;

  // Restore the previous visit's pages when returning from a venue detail.
  const [state, setState] = useState<LoadedState | null>(() =>
    sessionCache?.key === requestKey ? sessionCache : null
  );

  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelObserverRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<() => void>(() => {});
  const hasMoreRef = useRef(false);
  // Which search we've already issued a first-page request for. Restoring from
  // the cache counts as fetched, so a return trip doesn't refetch page 1.
  const fetchedKeyRef = useRef<string | null>(
    sessionCache?.key === requestKey ? requestKey : null
  );
  // Scroll offset to reapply once the restored cards are on screen; null when
  // this is a fresh search, which should start at the top.
  const restoredScrollRef = useRef<number | null>(
    sessionCache?.key === requestKey ? sessionCache.scrollTop : null
  );

  const loading = state?.key !== requestKey;
  const venues = state?.key === requestKey ? state.venues : [];
  const meta = state?.key === requestKey ? state.meta : null;
  const error = state?.key === requestKey ? state.error : null;

  useEffect(() => {
    // Already have this search's first page (fresh or restored) — don't refetch.
    if (fetchedKeyRef.current === requestKey) return;
    fetchedKeyRef.current = requestKey;

    // The mark above is provisional: it's set before the request resolves, so
    // if this effect is torn down first (StrictMode's double-mount in dev, or
    // any remount) the in-flight request is aborted and the re-run would hit
    // the early return above and never fetch — stranding the screen on its
    // skeleton with one canceled request. Release the mark unless the request
    // actually settled.
    let settled = false;
    const controller = new AbortController();

    void fetchNearbyVenues({
      lat,
      lng,
      radiusM: REQUESTED_RADIUS_M,
      limit: PAGE_SIZE,
      offset: 0,
      signal: controller.signal,
    })
      .then((res) => {
        if (controller.signal.aborted) return;
        settled = true;
        setState({
          key: requestKey,
          venues: res.venues ?? [],
          meta: {
            fallback: res.fallback,
            city_name: res.city_name,
            radius_used_m: res.radius_used_m,
          },
          nextOffset: res.next_offset,
          hasMore: res.has_more,
          error: null,
          loadMoreFailed: false,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        settled = true;
        setState({
          key: requestKey,
          venues: [],
          meta: null,
          nextOffset: 0,
          hasMore: false,
          error: err instanceof Error ? err.message : "Could not load nearby venues.",
          loadMoreFailed: false,
        });
      });

    return () => {
      controller.abort();
      if (!settled && fetchedKeyRef.current === requestKey) {
        fetchedKeyRef.current = null;
      }
    };
  }, [lat, lng, requestKey]);

  // Same gate the homescreen feed applies (HomescreenSection.tsx:1102):
  // guests are sent to the auth screen rather than into venue detail.
  const gatedVenueOpen = useCallback(
    (venueId: number) => (isLoggedIn ? onSelectVenue(venueId) : onRequireAuth()),
    [isLoggedIn, onSelectVenue, onRequireAuth]
  );

  const loadMore = useCallback(() => {
    if (loadingMore || !state?.hasMore) return;
    setLoadingMore(true);
    setState((prev) => (prev?.loadMoreFailed ? { ...prev, loadMoreFailed: false } : prev));

    const pageKey = state.key;
    void fetchNearbyVenues({
      lat,
      lng,
      radiusM: REQUESTED_RADIUS_M,
      limit: PAGE_SIZE,
      offset: state.nextOffset,
    })
      .then((res) => {
        setState((prev) => {
          // The search moved on while this page was in flight — drop it.
          if (!prev || prev.key !== pageKey) return prev;
          // Distinct venues can share a name and address, so dedupe on id only.
          const seen = new Set(prev.venues.map((v) => v.id));
          return {
            ...prev,
            venues: [...prev.venues, ...(res.venues ?? []).filter((v) => !seen.has(v.id))],
            nextOffset: res.next_offset,
            hasMore: res.has_more,
            loadMoreFailed: false,
          };
        });
      })
      .catch(() => {
        // Keep hasMore intact. Clearing it would render "that's everything
        // nearby" after a transient network blip — telling the user they've
        // seen every venue in their city, with no way back. Flag it instead so
        // the sentinel stops auto-firing and a retry button takes over.
        setState((prev) =>
          prev && prev.key === pageKey ? { ...prev, loadMoreFailed: true } : prev
        );
      })
      .finally(() => setLoadingMore(false));
  }, [lat, lng, loadingMore, state]);

  // Refreshed after every render (no dep array) so the observer callback below
  // always sees current values without the observer itself being recreated.
  // The observer only reads these when an intersection fires, which is always
  // after effects have run.
  useEffect(() => {
    loadMoreRef.current = loadMore;
    // While a retry is pending the sentinel must not auto-fire, or a persistent
    // failure would hammer the endpoint every time it scrolls into view.
    hasMoreRef.current = !!state?.hasMore && !state.loadMoreFailed;
  });

  // Mirror loaded pages into the session cache so returning from a venue
  // detail restores them instead of refetching page 1.
  useEffect(() => {
    if (state && state.key === requestKey && !state.error) {
      sessionCache = { ...state, scrollTop: sessionCache?.scrollTop ?? 0 };
    }
  }, [state, requestKey]);

  // Restore scroll on mount, and track it while scrolling. The scroll container
  // is <main> — globals.css puts body at overflow:hidden for the SPA shell.
  //
  // Recorded on every scroll rather than on unmount: <main> is shared with the
  // screen we navigate to, and by the time an unmount cleanup runs the DOM has
  // already swapped in that shorter screen, so the browser has clamped
  // scrollTop to its new maximum — usually 0. Reading it then saves the wrong
  // value.
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    if (restoredScrollRef.current !== null) {
      main.scrollTop = restoredScrollRef.current;
      restoredScrollRef.current = null;
    }

    const onScroll = () => {
      if (sessionCache) sessionCache.scrollTop = main.scrollTop;
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  // Callback ref rather than useRef + useEffect: the sentinel only exists once
  // the skeleton is replaced by real content, and an effect keyed on
  // [loadMore, hasMore] never re-runs for that mount, so the observer would
  // never attach. A callback ref fires the moment the node mounts.
  //
  // Deps are intentionally empty — the observer is created once per sentinel
  // mount and reads the refs for current state. Recreating it whenever
  // hasMore/loadMore changed would make observe() immediately re-run its
  // "currently intersecting?" check; with the sentinel still on-screen right
  // after a load, that fires another load instantly, over and over.
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

  // In fallback mode every distance_m is null and the venues are ~a country
  // away — withholding coordinates makes the card drop its distance line.
  const cardCoords = meta?.fallback ? null : userCoords ?? null;

  const widened =
    meta?.radius_used_m != null && meta.radius_used_m > REQUESTED_RADIUS_M
      ? meta.radius_used_m
      : null;

  return (
    <>
      {!hasFix ? (
        <Banner>
          We don&apos;t have your location, so these are venues in Houston.{" "}
          {onAllowLocation ? (
            <button
              type="button"
              onClick={onAllowLocation}
              className="font-semibold text-red-400 underline underline-offset-2"
            >
              Use my location
            </button>
          ) : null}
        </Banner>
      ) : meta?.fallback ? (
        <Banner>
          We&apos;re not in your city yet — here&apos;s what&apos;s happening in{" "}
          {meta.city_name}.
        </Banner>
      ) : widened ? (
        <Banner>
          Nothing that close — showing venues within {(widened / 1000).toFixed(1)} km.
        </Banner>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <VenueSkeleton />
          <VenueSkeleton />
          <VenueSkeleton />
        </div>
      ) : error ? (
        <div className="mt-16 flex flex-col items-center gap-3 px-6 text-center">
          <p className="text-[0.85rem] text-white/40">Could not load nearby venues.</p>
          <p className="text-[0.72rem] text-white/25">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-2 rounded-full border border-white/20 px-5 py-2 text-[0.78rem] font-semibold text-white/70"
          >
            Try Again
          </button>
        </div>
      ) : venues.length === 0 ? (
        <p className="mt-16 text-center text-[0.85rem] text-white/40">
          No venues found around you right now.
        </p>
      ) : (
        <div className="space-y-3">
          {venues.map((venue, index) => (
            <ResultCard
              key={venue.id}
              venue={nearbyVenueToGenieVenue(venue)}
              index={index}
              userCoords={cardCoords}
              // This endpoint carries no energy_level, so the derived tagline
              // would read "Lively spot" on every single card. The venue's own
              // description is the useful line — on the ~59% of rows that have
              // one; the rest fall back to name + neighborhood + status.
              tagline={null}
              // This endpoint sends no is_open_now / best_time_to_go, and its
              // social_energy_state is "quiet" on every row while the
              // enrichment jobs are off — so the derived status would be
              // invented from the list index. Show nothing instead.
              status={null}
              // No stand-in photo: a venue without an image gets an empty slot
              // rather than a stock picture that isn't the venue.
              fallbackImage={null}
              description={venue.short_description}
              onOpen={() => gatedVenueOpen(venue.id)}
              isSaved={savedVenueIds.includes(String(venue.id))}
              onSave={() => onToggleSaveVenue(nearbyVenueToGenieVenue(venue))}
            />
          ))}

          {/* Tripwire for infinite scroll — sits just below the last card. */}
          <div ref={sentinelCallbackRef} className="h-4" />

          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          )}

          {!loadingMore && state?.loadMoreFailed && (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="text-[0.78rem] text-white/40">
                Couldn&apos;t load more venues.
              </p>
              <button
                type="button"
                onClick={loadMore}
                className="rounded-full border border-white/20 px-5 py-2 text-[0.78rem] font-semibold text-white/75"
              >
                Try Again
              </button>
            </div>
          )}

          {!loadingMore && !state?.hasMore && !state?.loadMoreFailed && (
            <p className="py-6 text-center text-[0.78rem] text-white/35">
              That&apos;s everything nearby for now
            </p>
          )}
        </div>
      )}
    </>
  );
}

function SavedVenuesList({
  userCoords,
  onSelectVenue,
  isLoggedIn,
  onRequireAuth,
  onSignIn,
  savedVenueIds,
  onToggleSaveVenue,
}: {
  userCoords?: { lat: number; lng: number } | null;
  onSelectVenue: (venueId: number) => void;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
  onSignIn: () => void;
  savedVenueIds: string[];
  onToggleSaveVenue: (venue: GenieVenue) => void;
}) {
  const [venues, setVenues] = useState<GenieVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const gatedVenueOpen = useCallback(
    (venueId: number) => (isLoggedIn ? onSelectVenue(venueId) : onRequireAuth()),
    [isLoggedIn, onSelectVenue, onRequireAuth]
  );

  useEffect(() => {
    if (!isLoggedIn) {
      setVenues([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSavedVenues()
      .then((list) => {
        if (!cancelled) setVenues(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load saved venues.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, reloadKey]);

  if (!isLoggedIn) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 rounded-[20px] border border-gray-200 bg-white/90 px-4 py-10 text-center dark:border-white/15 dark:bg-black/20">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Sign in to see your saved venues</p>
        <p className="max-w-xs text-xs text-gray-600 dark:text-white/60">
          Create a free account to save venues and find them here.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-1 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <VenueSkeleton />
        <VenueSkeleton />
        <VenueSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-16 flex flex-col items-center gap-3 px-6 text-center">
        <p className="text-[0.85rem] text-white/40">Could not load saved venues.</p>
        <p className="text-[0.72rem] text-white/25">{error}</p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="mt-2 rounded-full border border-white/20 px-5 py-2 text-[0.78rem] font-semibold text-white/70"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <p className="mt-16 text-center text-[0.85rem] text-white/40">
        You haven&apos;t saved any venues yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {venues.map((venue, index) => (
        <ResultCard
          key={venue.id}
          venue={venue}
          index={index}
          userCoords={userCoords}
          tagline={null}
          status={null}
          fallbackImage={null}
          description={venue.vibe_notes ?? null}
          onOpen={() => gatedVenueOpen(Number(venue.id))}
          isSaved={savedVenueIds.includes(String(venue.id))}
          onSave={() => {
            onToggleSaveVenue(venue);
            // Optimistic: this list only shows saved venues, so unsaving
            // one should drop it immediately rather than wait for a refetch.
            setVenues((prev) => prev.filter((v) => String(v.id) !== String(venue.id)));
          }}
        />
      ))}
    </div>
  );
}

export default function NearbyVenuesPage({
  userCoords,
  onBack,
  onSelectVenue,
  onAllowLocation,
  isLoggedIn,
  onRequireAuth,
  onSignIn,
  savedVenueIds,
  onToggleSaveVenue,
}: {
  userCoords?: { lat: number; lng: number } | null;
  onBack: () => void;
  onSelectVenue: (venueId: number) => void;
  onAllowLocation?: () => void;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
  onSignIn: () => void;
  savedVenueIds: string[];
  onToggleSaveVenue: (venue: GenieVenue) => void;
}) {
  const [tab, setTab] = useState<VenuesTab>("explore");

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
          Venues Near You
        </h2>
      </div>

      <div className="mb-4 flex items-center gap-1 rounded-full border border-red-200 bg-white/70 p-1 dark:border-white/10 dark:bg-black/24">
        {([
          { id: "explore", label: "Explore" },
          { id: "saved", label: "Saved" },
        ] as { id: VenuesTab; label: string }[]).map((t) => (
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

      {tab === "explore" ? (
        <ExploreVenuesList
          key="explore"
          userCoords={userCoords}
          onSelectVenue={onSelectVenue}
          onAllowLocation={onAllowLocation}
          isLoggedIn={isLoggedIn}
          onRequireAuth={onRequireAuth}
          savedVenueIds={savedVenueIds}
          onToggleSaveVenue={onToggleSaveVenue}
        />
      ) : (
        <SavedVenuesList
          key="saved"
          userCoords={userCoords}
          onSelectVenue={onSelectVenue}
          isLoggedIn={isLoggedIn}
          onRequireAuth={onRequireAuth}
          onSignIn={onSignIn}
          savedVenueIds={savedVenueIds}
          onToggleSaveVenue={onToggleSaveVenue}
        />
      )}
    </section>
  );
}
