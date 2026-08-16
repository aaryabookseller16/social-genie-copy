"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { type ConsumerAccount } from "@/app/lib/localState";
import {
  createProducerEvent,
  createProducerPost,
  cancelProducerEvent,
  deleteProducerPost,
  fetchMyEvents,
  fetchMyPosts,
  fetchMyProducerProfile,
  fetchProducerAudienceAnalytics,
  fetchProducerEventAnalytics,
  fetchProducerInfluencerOffers,
  fetchProducerRsvpList,
  fetchProducerNotifPrefs,
  updateProducerNotifPrefs,
  reviewProducerOffer,
  searchVendorBusinesses,
  setupProducerProfile,
  type InfluencerOffer,
  type ProducerAudienceAnalytics,
  type ProducerEvent,
  type ProducerEventAnalytics,
  type ProducerPost,
  type ProducerProfile,
  type ProducerRsvpEntry,
  type VideoItem,
} from "@/app/lib/publicApiClient";
import { type GenieVenue } from "@/app/lib/genieTypes";
import { galleryFor, mediaGalleryFor } from "@/app/lib/image";
import ImageUploader from "@/app/components/ImageUploader";
import VideoUploader, { type VideoSlotValue } from "@/app/components/VideoUploader";
import ImageGallery from "@/app/components/ImageGallery";
import { ActionButton } from "./ui";

/* ------------------------------------------------------------------ */
/*  Producer profile ID cache                                         */
/*  Stores the Xano producer table row ID (NOT the user ID) so the   */
/*  gate check can look up the correct row on return visits.         */
/*  Still server-verified every visit — this is just the ID mapping. */
/* ------------------------------------------------------------------ */

const PRODUCER_ID_KEY = "genie_producer_id_v1";

function readCachedProducerId(): number | null {
  try {
    const val = typeof window !== "undefined" ? localStorage.getItem(PRODUCER_ID_KEY) : null;
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}

function writeCachedProducerId(id: number) {
  try { localStorage.setItem(PRODUCER_ID_KEY, String(id)); } catch {}
}

function clearCachedProducerId() {
  try { localStorage.removeItem(PRODUCER_ID_KEY); } catch {}
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ProducerStep =
  | "loading"
  | "error"
  | "onboarding"
  | "pending-approval"
  | "dashboard"
  | "create-event"
  | "edit-event"
  | "event-detail"
  | "audience"
  | "create-post"
  | "edit-profile"
  | "settings"
  | "offers";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-2xl border border-gray-300 bg-transparent px-4 py-3.5 text-gray-900 placeholder:text-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]";

const EVENT_CATEGORIES = [
  "Concert",
  "Club Night",
  "Comedy",
  "Art & Culture",
  "Sports",
  "Food & Drink",
  "Festival",
  "Networking",
  "Private Event",
  "Other",
];

const PRODUCER_EVENT_TAGS = [
  "Nightlife", "Brunch", "Concerts", "Sports",
  "Networking", "Comedy", "Day Party", "Festivals"
];

/* ------------------------------------------------------------------ */
/*  Follower line chart                                                */
/* ------------------------------------------------------------------ */

function FollowerChart({ data }: { data: number[] }) {
  const VW = 300;
  const VH = 110;
  const pad = { top: 14, right: 40, bottom: 10, left: 32 };
  const cw = VW - pad.left - pad.right;
  const ch = VH - pad.top - pad.bottom;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts: [number, number][] = data.map((v, i) => [
    pad.left + (i / (data.length - 1)) * cw,
    pad.top + (1 - (v - min) / range) * ch,
  ]);

  function bezierPath(points: [number, number][]): string {
    if (points.length < 2) return "";
    const t = 0.35;
    const d: string[] = [`M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const cp1x = (p1[0] + (p2[0] - p0[0]) * t).toFixed(1);
      const cp1y = (p1[1] + (p2[1] - p0[1]) * t).toFixed(1);
      const cp2x = (p2[0] - (p3[0] - p1[0]) * t).toFixed(1);
      const cp2y = (p2[1] - (p3[1] - p1[1]) * t).toFixed(1);
      d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`);
    }
    return d.join(" ");
  }

  const linePath = bezierPath(pts);
  const lastPt = pts[pts.length - 1];
  const gridYs = [pad.top, pad.top + ch / 2, pad.top + ch];

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full"
      style={{ height: 110 }}
    >
      {/* Dashed grid lines */}
      {gridYs.map((y, i) => (
        <line
          key={i}
          x1={pad.left} y1={y}
          x2={VW - pad.right} y2={y}
          stroke="rgba(255,255,255,0.07)"
          strokeDasharray="4 3"
        />
      ))}

      {/* Gradient fill under line */}
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${linePath} L ${lastPt[0].toFixed(1)} ${pad.top + ch} L ${pts[0][0].toFixed(1)} ${pad.top + ch} Z`}
        fill="url(#chartFill)"
      />

      {/* Line */}
      <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.2" fill="#f59e0b" />
      ))}

      {/* Min label left */}
      <text x={pad.left - 4} y={pad.top + ch} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.35)" dominantBaseline="middle">
        {min}
      </text>

      {/* Current value label (last point) */}
      <text x={VW - pad.right + 5} y={lastPt[1]} textAnchor="start" fontSize="9" fill="#f59e0b" dominantBaseline="middle">
        {data[data.length - 1]}
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Event detail helpers                                              */
/* ------------------------------------------------------------------ */

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatTimeRange(start?: string, end?: string): string {
  if (!start && !end) return "";
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`;
  return start ? formatTime(start) : end ? formatTime(end) : "";
}

function formatEventDate(dateStr?: string): string {
  if (!dateStr) return "";
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });
}

const POST_TEXT_MAX = 2000;

/** Local (not UTC) today as YYYY-MM-DD, comparable against a `<input type="date">` value. */
function todayDateStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/*  Small shared pieces                                                */
/* ------------------------------------------------------------------ */

function SectionHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pb-2 pt-1">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/60 text-gray-700 transition hover:bg-gray-100 dark:border-white/15 dark:bg-black/25 dark:text-white/80 dark:hover:bg-white/10"
        aria-label="Back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <h1 className="font-[family:var(--font-display)] text-[1.45rem] font-semibold leading-tight text-gray-900 dark:text-white">
        {title}
      </h1>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[13px] font-medium text-gray-600 dark:text-white/60">
      {children}
    </p>
  );
}

function FormField({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {error ? <p className="mt-1 text-[0.78rem] text-red-500">{error}</p> : null}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/60 p-4 dark:border-white/10 dark:bg-black/20">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-white/40">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function EventCard({
  event,
  onSelect,
}: {
  event: ProducerEvent;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-gray-200 bg-white/60 p-4 text-left transition hover:border-red-300 dark:border-white/10 dark:bg-black/20 dark:hover:border-red-600/50"
    >
      <p className="font-semibold text-gray-900 dark:text-white">{event.title}</p>
      {event.event_date ? (
        <p className="mt-0.5 text-sm text-gray-500 dark:text-white/50">{event.event_date}</p>
      ) : null}
      {event.venue_name ? (
        <p className="mt-0.5 text-sm text-gray-500 dark:text-white/50">{event.venue_name}</p>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        {event.category ? (
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/25 dark:text-red-400">
            {event.category}
          </span>
        ) : null}
        {typeof event.rsvp_count === "number" ? (
          <span className="text-xs text-gray-400 dark:text-white/35">
            {event.rsvp_count} RSVPs
          </span>
        ) : null}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ProducerSection({
  account,
  onBack,
}: {
  account: ConsumerAccount | null;
  onBack: () => void;
}) {
  const [step, setStep] = useState<ProducerStep>("loading");
  const [gateError, setGateError] = useState<string | null>(null);

  /* profile & data */
  const [profile, setProfile] = useState<ProducerProfile | null>(null);
  const [events, setEvents] = useState<ProducerEvent[]>([]);
  const [posts, setPosts] = useState<ProducerPost[]>([]);
  const [followerHistory, setFollowerHistory] = useState<number[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ProducerEvent | null>(null);
  const [eventAnalytics, setEventAnalytics] = useState<ProducerEventAnalytics | null>(null);
  const [eventAnalyticsError, setEventAnalyticsError] = useState(false);
  const [rsvpList, setRsvpList] = useState<ProducerRsvpEntry[]>([]);
  const [audienceAnalytics, setAudienceAnalytics] = useState<ProducerAudienceAnalytics | null>(null);
  const [audienceAnalyticsError, setAudienceAnalyticsError] = useState(false);

  /* influencer offer review queue (event owner) */
  const [producerOffers, setProducerOffers] = useState<InfluencerOffer[]>([]);
  const [isLoadingProducerOffers, setIsLoadingProducerOffers] = useState(false);
  const [producerOfferError, setProducerOfferError] = useState<string | null>(null);
  const [producerOfferFilter, setProducerOfferFilter] = useState<
    "active" | "pending" | "rejected" | "cancelled"
  >("pending");
  const [rejectingProducerOfferId, setRejectingProducerOfferId] = useState<number | null>(null);
  const [producerRejectReason, setProducerRejectReason] = useState("");
  const [reviewingProducerOfferId, setReviewingProducerOfferId] = useState<number | null>(null);
  const [producerOfferMessage, setProducerOfferMessage] = useState<string | null>(null);

  /* onboarding form state */
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingBio, setOnboardingBio] = useState("");
  const [onboardingIg, setOnboardingIg] = useState("");
  const [onboardingTags, setOnboardingTags] = useState<string[]>([]);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  /* pending-approval state */
  const [checkingStatus, setCheckingStatus] = useState(false);

  /* FAB state */
  const [fabOpen, setFabOpen] = useState(false);

  /* event-detail state */
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  /* create-event form state */
  const [evTitle, setEvTitle] = useState("");
  const [evCategory, setEvCategory] = useState("");
  const [evDescription, setEvDescription] = useState("");
  const [evDate, setEvDate] = useState("");
  const [evStartTime, setEvStartTime] = useState("");
  const [evEndTime, setEvEndTime] = useState("");
  const [evVenue, setEvVenue] = useState("");
  const [evVenueId, setEvVenueId] = useState<number | null>(null);
  const [evVenueQuery, setEvVenueQuery] = useState("");
  const [evVenueResults, setEvVenueResults] = useState<GenieVenue[]>([]);
  const [evVenueSearching, setEvVenueSearching] = useState(false);
  const [evVenueManual, setEvVenueManual] = useState(false);
  const [evCity, setEvCity] = useState("");
  const [evTicketUrl, setEvTicketUrl] = useState("");
  /** Ordered event gallery; index 0 is the cover. Capped at 5 by Xano. */
  const [evImageUrls, setEvImageUrls] = useState<string[]>([]);
  const [evUploading, setEvUploading] = useState(false);
  /** Separate video list; combined count with evImageUrls is capped at 5 by Xano. */
  const [evVideos, setEvVideos] = useState<VideoSlotValue[]>([]);
  const [evVideoUploading, setEvVideoUploading] = useState(false);
  const [evBusy, setEvBusy] = useState(false);
  const [evError, setEvError] = useState<string | null>(null);
  const [evFieldErrors, setEvFieldErrors] = useState<Record<string, string>>({});
  const editingEventId = useRef<number | null>(null);
  const [eventActionBusy, setEventActionBusy] = useState(false);
  const [eventActionError, setEventActionError] = useState<string | null>(null);

  /* create-post form state */
  const [postText, setPostText] = useState("");
  /** Ordered post gallery; index 0 is the primary. Capped at 5 by Xano. */
  const [postImageUrls, setPostImageUrls] = useState<string[]>([]);
  const [postShowImageInput, setPostShowImageInput] = useState(false);
  const [postUploading, setPostUploading] = useState(false);
  /** Separate video list; combined count with postImageUrls is capped at 5 by Xano. */
  const [postVideos, setPostVideos] = useState<VideoSlotValue[]>([]);
  const [postVideoUploading, setPostVideoUploading] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState(false);
  const [postActionBusyId, setPostActionBusyId] = useState<number | null>(null);

  /* edit-profile form state */
  const [profName, setProfName] = useState("");
  const [profBio, setProfBio] = useState("");
  const [profIg, setProfIg] = useState("");
  const [profTags, setProfTags] = useState<string[]>([]);
  const [profPhotoUrls, setProfPhotoUrls] = useState<string[]>([]);
  const [profPhotoUploading, setProfPhotoUploading] = useState(false);
  const [profBusy, setProfBusy] = useState(false);
  const [profError, setProfError] = useState<string | null>(null);

  /* settings state */
  const [settingsForm, setSettingsForm] = useState({
    notify_new_follower:       true,
    notify_post_like:          true,
    notify_post_comment:       true,
    notify_going_match:        true,
    notify_venue_energy_alert: false,
    notify_event_reminder:     true,
    notify_promoter_new_event: true,
    notify_new_message:        true,
    notify_genie_alerts:       true,
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [eventsLoading, setEventsLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);

  useEffect(() => {
    if (step !== "settings" || settingsLoaded) return;
    fetchProducerNotifPrefs().then((prefs) => {
      setSettingsForm({
        notify_new_follower:       prefs.notify_new_follower       ?? true,
        notify_post_like:          prefs.notify_post_like          ?? true,
        notify_post_comment:       prefs.notify_post_comment       ?? true,
        notify_going_match:        prefs.notify_going_match        ?? true,
        notify_venue_energy_alert: prefs.notify_venue_energy_alert ?? false,
        notify_event_reminder:     prefs.notify_event_reminder     ?? true,
        notify_promoter_new_event: prefs.notify_promoter_new_event ?? true,
        notify_new_message:        prefs.notify_new_message        ?? true,
        notify_genie_alerts:       prefs.notify_genie_alerts       ?? true,
      });
      setSettingsLoaded(true);
    }).catch(() => setSettingsLoaded(true));
  }, [step, settingsLoaded]);

  const refreshEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const data = await fetchMyEvents();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      /* non-fatal — keep existing list */
    } finally {
      setEventsLoading(false);
    }
  }, []);

  /* Generate 10-day placeholder follower history from current count.
   * Replaced with real data once ep_get_follower_history_dev is available. */
  const generateFollowerHistory = useCallback((currentCount: number, seed: number) => {
    const days = 10;
    const history: number[] = [];
    let val = Math.max(0, currentCount - Math.floor(currentCount * 0.3));
    for (let i = 0; i < days; i++) {
      const noise = ((seed * (i + 1) * 1103515245 + 12345) & 0x7fffffff) % 5;
      val = Math.max(0, val + (i % 3 === 0 ? noise : -Math.floor(noise / 2)));
      history.push(val);
    }
    history[days - 1] = currentCount;
    setFollowerHistory(history);
  }, []);

  const refreshPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const data = await fetchMyPosts();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch {
      /* non-fatal — keep existing list */
    } finally {
      setPostsLoading(false);
    }
  }, []);

  /**
   * A failed check is NOT the same as "you have no producer profile". Falling
   * through to the onboarding form on error is what made already-onboarded
   * producers get asked to register again on every role switch — an expired
   * token, a Xano blip or a dropped connection all rendered the signup screen.
   * Only an explicit `profile: null` from Xano may show it; everything else is
   * a load failure the user can retry. See app/api/producer/profile/route.ts.
   */
  const checkRunRef = useRef(0);

  const runProfileCheck = useCallback(async () => {
    const runId = ++checkRunRef.current;
    setStep("loading");
    setGateError(null);

    try {
      const data = await fetchMyProducerProfile();
      // A superseded run (account switch, remount) must not write state.
      if (runId !== checkRunRef.current) return;

      const p = data.profile;
      if (p && p.id) {
        writeCachedProducerId(p.id);
        setProfile(p);
        if (p.status === "pending") {
          setStep("pending-approval");
        } else {
          setStep("dashboard");
          refreshEvents();
          refreshPosts();
          generateFollowerHistory(p.follower_count ?? 0, p.id ?? 1);
        }
      } else {
        // Xano genuinely holds no producer row for this user — the only case
        // that should ever show the signup form. Drop the cached id too, or a
        // previous account's producer_id would ride along on the next create.
        clearCachedProducerId();
        setStep("onboarding");
      }
    } catch (err) {
      if (runId !== checkRunRef.current) return;
      setGateError(
        err instanceof Error
          ? err.message
          : "Could not check your producer profile."
      );
      setStep("error");
    }
  }, [refreshEvents, refreshPosts, generateFollowerHistory]);

  useEffect(() => {
    void runProfileCheck();
  }, [account?.id, runProfileCheck]);

  function addEvent(raw: ProducerEvent) {
    /* Xano may wrap the created event: { success, event: { id, title, ... } } */
    const r = raw as unknown as Record<string, unknown>;
    const ev = (r.event as ProducerEvent | undefined) ?? raw;
    setEvents((prev) => {
      if (ev.id && prev.some((e) => e.id === ev.id)) return prev;
      return [ev, ...prev];
    });
  }

  /* ---- Populate edit-event fields ---- */
  function openEditEvent(ev: ProducerEvent) {
    editingEventId.current = ev.id;
    setEvTitle(ev.title ?? "");
    setEvCategory(ev.category ?? "");
    setEvDescription(ev.description ?? "");
    setEvDate(ev.event_date ?? "");
    setEvStartTime(ev.start_time ?? "");
    setEvEndTime(ev.end_time ?? "");
    setEvVenue(ev.venue_name ?? "");
    setEvVenueId(null);
    setEvVenueQuery("");
    setEvVenueResults([]);
    setEvVenueManual(!!(ev.venue_name));
    setEvCity(ev.city ?? "");
    setEvTicketUrl(ev.ticket_url ?? "");
    setEvImageUrls(galleryFor(ev.cover_image_url, ev.image_urls));
    setEvUploading(false);
    setEvError(null);
    setEvFieldErrors({});
    setStep("edit-event");
  }

  /* ---- Open event detail ---- */
  async function openEventDetail(ev: ProducerEvent) {
    setSelectedEvent(ev);
    setEventAnalytics(null);
    setEventAnalyticsError(false);
    setRsvpList([]);
    setDescriptionExpanded(false);
    setStep("event-detail");
    try {
      const [analytics, rsvps] = await Promise.all([
        fetchProducerEventAnalytics(ev.id),
        fetchProducerRsvpList(ev.id),
      ]);
      setEventAnalytics(analytics);
      const rsvpArray = Array.isArray(rsvps)
        ? rsvps
        : Array.isArray((rsvps as { rsvps?: ProducerRsvpEntry[] }).rsvps)
          ? (rsvps as { rsvps?: ProducerRsvpEntry[] }).rsvps!
          : [];
      setRsvpList(rsvpArray);
    } catch {
      setEventAnalyticsError(true);
    }
  }

  /* ---- Open audience analytics ---- */
  async function openAudience() {
    setAudienceAnalytics(null);
    setAudienceAnalyticsError(false);
    setStep("audience");
    try {
      const result = await fetchProducerAudienceAnalytics();
      setAudienceAnalytics(result);
    } catch {
      setAudienceAnalyticsError(true);
    }
  }

  /* ---- Influencer offer review queue (event owner) ---- */
  const loadProducerOffers = useCallback(async () => {
    setIsLoadingProducerOffers(true);
    setProducerOfferError(null);
    try {
      const res = await fetchProducerInfluencerOffers();
      setProducerOffers(res.offers ?? []);
    } catch (err) {
      setProducerOffers([]);
      setProducerOfferError(
        err instanceof Error ? err.message : "Could not load offers."
      );
    } finally {
      setIsLoadingProducerOffers(false);
    }
  }, []);

  useEffect(() => {
    if (step !== "offers") return;
    void loadProducerOffers();
  }, [step, loadProducerOffers]);

  const handleReviewProducerOffer = useCallback(
    async (
      offerId: number,
      decision: "approve" | "reject" | "cancel",
      reason?: string
    ) => {
      setReviewingProducerOfferId(offerId);
      setProducerOfferMessage(null);
      try {
        await reviewProducerOffer({
          offer_id: offerId,
          decision,
          rejection_reason: reason,
        });
        const newStatus =
          decision === "approve"
            ? "active"
            : decision === "cancel"
              ? "cancelled"
              : "rejected";
        setProducerOffers((prev) =>
          prev.map((o) =>
            o.id === offerId
              ? { ...o, status: newStatus, rejection_reason: reason }
              : o
          )
        );
        setRejectingProducerOfferId(null);
        setProducerRejectReason("");
        setProducerOfferMessage(
          decision === "approve"
            ? "Offer approved."
            : decision === "cancel"
              ? "Offer cancelled."
              : "Offer rejected."
        );
      } catch (err) {
        setProducerOfferMessage(
          err instanceof Error ? err.message : "Could not review offer."
        );
      } finally {
        setReviewingProducerOfferId(null);
      }
    },
    []
  );

  /* ---- Open create-event (fresh) ---- */
  function openCreateEvent() {
    editingEventId.current = null;
    setEvTitle(""); setEvCategory(""); setEvDescription(""); setEvDate("");
    setEvStartTime(""); setEvEndTime(""); setEvVenue(""); setEvCity("");
    setEvTicketUrl("");
    setEvImageUrls([]); setEvUploading(false);
    setEvVideos([]); setEvVideoUploading(false);
    setEvError(null); setEvFieldErrors({});
    setStep("create-event");
  }

  /* ---- Open create-post (fresh) ---- */
  function openCreatePost() {
    setPostText(""); setPostImageUrls([]); setPostShowImageInput(false);
    setPostUploading(false);
    setPostVideos([]); setPostVideoUploading(false);
    setPostError(null); setPostSuccess(false);
    setStep("create-post");
  }

  /* ---- Open edit-profile ---- */
  function openEditProfile() {
    setProfName(profile?.display_name ?? account?.firstName ?? "");
    setProfBio(profile?.bio ?? "");
    setProfIg(profile?.instagram_handle ?? "");
    setProfTags(profile?.event_type_tags ?? []);
    setProfPhotoUrls(profile?.profile_photo_url ? [profile.profile_photo_url] : []);
    setProfError(null);
    setStep("edit-profile");
  }

  /* ================================================================ */
  /*  Handlers                                                         */
  /* ================================================================ */

  async function handleOnboardingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onboardingName.trim()) {
      setOnboardingError("Please enter your brand or stage name.");
      return;
    }
    setOnboardingBusy(true);
    setOnboardingError(null);
    try {
      const raw = await setupProducerProfile({
        display_name: onboardingName.trim(),
        bio: onboardingBio.trim() || undefined,
        instagram_handle: onboardingIg.trim() || undefined,
        event_type_tags: onboardingTags.length > 0 ? onboardingTags : undefined,
      });
      /* Xano wraps the profile: { success, message, profile: { id, display_name, ... } } */
      const rawRecord = raw as Record<string, unknown>;
      const profileData = (rawRecord.profile as ProducerProfile | undefined) ?? (raw as ProducerProfile);
      const profileId = (profileData as Record<string, unknown>)?.id;
      if (typeof profileId === "number" && profileId > 0) {
        writeCachedProducerId(profileId);
      }
      setProfile(profileData);
      if (profileData.status === "pending") {
        setStep("pending-approval");
      } else {
        setStep("dashboard");
        refreshEvents();
        refreshPosts();
      }
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setOnboardingBusy(false);
    }
  }

  async function handleVenueSearch() {
    if (!evVenueQuery.trim()) return;
    setEvVenueSearching(true);
    try {
      const results = await searchVendorBusinesses(evVenueQuery.trim(), evCity.trim() || "Houston");
      setEvVenueResults(results);
    } catch {
      setEvVenueResults([]);
    } finally {
      setEvVenueSearching(false);
    }
  }

  async function handleEventSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!evTitle.trim()) errors.title = "Event title is required.";
    if (!evCategory) errors.category = "Please select a category.";
    if (!evDate) errors.date = "Event date is required.";
    else if (evDate < todayDateStr()) errors.date = "Event date can't be in the past.";
    if (!evStartTime) errors.startTime = "Start time is required.";
    if (evStartTime && evEndTime && evEndTime <= evStartTime) {
      errors.endTime = "End time must be after start time.";
    }
    if (Object.keys(errors).length > 0) {
      setEvFieldErrors(errors);
      setEvError(null);
      return;
    }
    setEvFieldErrors({});
    if (evUploading || evVideoUploading) { setEvError("Please wait for your photos and videos to finish uploading."); return; }
    setEvBusy(true);
    setEvError(null);
    try {
      const videoUrls: VideoItem[] = evVideos.map((v) => ({ url: v.url, thumbnail_url: v.thumbnailUrl }));
      const created = await createProducerEvent({
        title: evTitle.trim(),
        category: evCategory,
        producer_id: readCachedProducerId() ?? undefined,
        description: evDescription.trim() || undefined,
        event_date: evDate,
        start_time: evStartTime,
        end_time: evEndTime || undefined,
        venue_id: evVenueId ?? undefined,
        venue_name: evVenue.trim() || undefined,
        city: evCity.trim() || undefined,
        ticket_url: evTicketUrl.trim() || undefined,
        cover_image_url: evImageUrls[0] || undefined,
        image_urls: evImageUrls,
        video_urls: videoUrls.length > 0 ? videoUrls : undefined,
        event_id: editingEventId.current ?? undefined,
      });
      const createdRaw = created as unknown as Record<string, unknown>;
      const createdEvent = (createdRaw.event as ProducerEvent | undefined) ?? created;
      if (editingEventId.current) {
        setEvents((prev) =>
          prev.map((e) => (e.id === editingEventId.current ? { ...e, ...createdEvent } : e))
        );
      } else {
        addEvent(created);
      }
      setStep("dashboard");
    } catch (err) {
      setEvError(err instanceof Error ? err.message : "Could not save event. Please try again.");
    } finally {
      setEvBusy(false);
    }
  }

  async function handlePostSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!postText.trim()) { setPostError("Post text is required."); return; }
    if (postText.trim().length > POST_TEXT_MAX) { setPostError(`Post text must be ${POST_TEXT_MAX} characters or fewer.`); return; }
    if (postImageUrls.length + postVideos.length > 5) { setPostError("A post can have at most 5 photos and videos combined."); return; }
    if (postUploading || postVideoUploading) { setPostError("Please wait for your photos and videos to finish uploading."); return; }
    setPostBusy(true);
    setPostError(null);
    try {
      const postVideoUrls: VideoItem[] = postVideos.map((v) => ({ url: v.url, thumbnail_url: v.thumbnailUrl }));
      const raw = await createProducerPost({
        post_text: postText.trim(),
        image_url: postImageUrls[0] || undefined,
        image_urls: postImageUrls,
        video_urls: postVideoUrls.length > 0 ? postVideoUrls : undefined,
      });
      // Xano returns { success: true, post: { id, post_text, ... } }
      const r = raw as unknown as Record<string, unknown>;
      const newPost = (r.post as ProducerPost | undefined) ?? (raw as unknown as ProducerPost);
      if (newPost?.id) {
        setPosts((prev) => [newPost, ...prev]);
      }
      setPostSuccess(true);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Could not create post. Please try again.");
    } finally {
      setPostBusy(false);
    }
  }

  async function handleCancelEvent(eventId: number) {
    setEventActionBusy(true);
    setEventActionError(null);
    try {
      await cancelProducerEvent(eventId);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, status: "cancelled" } : e))
      );
      setSelectedEvent((prev) =>
        prev && prev.id === eventId ? { ...prev, status: "cancelled" } : prev
      );
    } catch (err) {
      setEventActionError(err instanceof Error ? err.message : "Could not cancel event.");
    } finally {
      setEventActionBusy(false);
    }
  }

  async function handleDeletePost(postId: number) {
    setPostActionBusyId(postId);
    try {
      await deleteProducerPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      /* non-fatal — leave the post in the list, user can retry */
    } finally {
      setPostActionBusyId(null);
    }
  }

  async function handleCheckStatus() {
    setCheckingStatus(true);
    try {
      const data = await fetchMyProducerProfile();
      const p = data.profile;
      if (p && p.id) {
        writeCachedProducerId(p.id);
        setProfile(p);
        if (p.status === "pending") {
          setStep("pending-approval");
        } else {
          setStep("dashboard");
          refreshEvents();
          refreshPosts();
          generateFollowerHistory(p.follower_count ?? 0, p.id ?? 1);
        }
      } else {
        setStep("onboarding");
      }
    } catch {
      /* stay on pending screen — non-fatal */
    } finally {
      setCheckingStatus(false);
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profName.trim()) { setProfError("Display name is required."); return; }
    setProfBusy(true);
    setProfError(null);
    try {
      const raw = await setupProducerProfile({
        display_name: profName.trim(),
        bio: profBio.trim() || undefined,
        instagram_handle: profIg.trim() || undefined,
        profile_photo_url: profPhotoUrls[0] || undefined,
        event_type_tags: profTags.length > 0 ? profTags : undefined,
      });
      const rawRecord = raw as Record<string, unknown>;
      const profileData = (rawRecord.profile as ProducerProfile | undefined) ?? (raw as ProducerProfile);
      const profileId = (profileData as Record<string, unknown>)?.id;
      if (typeof profileId === "number" && profileId > 0) {
        writeCachedProducerId(profileId);
      }
      setProfile(profileData);
      setStep("dashboard");
    } catch (err) {
      setProfError(err instanceof Error ? err.message : "Could not save profile. Please try again.");
    } finally {
      setProfBusy(false);
    }
  }

  async function handleShare() {
    const url = selectedEvent?.ticket_url ?? (typeof window !== "undefined" ? window.location.href : "");
    const title = selectedEvent?.title ?? "Event";
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title, url }); } catch {}
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try { await navigator.clipboard.writeText(url); } catch {}
    }
  }

  async function handleSettingsSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsMessage(null);
    try {
      await updateProducerNotifPrefs(settingsForm);
      setSettingsMessage("Settings saved.");
      setTimeout(() => setSettingsMessage(null), 2500);
    } catch {
      setSettingsMessage("Could not save settings. Try again.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  const displayName =
    profile?.display_name ?? account?.firstName ?? "Producer";

  /* ---- Loading ---- */
  if (step === "loading") {
    return (
      <section className="flex min-h-[40vh] flex-col items-center justify-center gap-4 pb-28">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-200 border-t-red-600 dark:border-white/10 dark:border-t-red-500" />
        <p className="text-sm text-gray-500 dark:text-white/50">Checking your profile…</p>
        {gateError ? (
          <p className="mt-2 text-sm text-red-500">{gateError}</p>
        ) : null}
      </section>
    );
  }

  /* ---- Pending approval ---- */
  if (step === "pending-approval") {
    return (
      <section className="flex min-h-[55vh] flex-col items-center justify-center gap-6 pb-28 text-center">
        {/* Hourglass icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-9 w-9 text-amber-500 dark:text-amber-400"
          >
            <path d="M5 22h14" />
            <path d="M5 2h14" />
            <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
            <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="font-[family:var(--font-display)] text-[1.6rem] font-semibold text-gray-900 dark:text-white">
            Application under review
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-gray-500 dark:text-white/55">
            Your producer profile has been submitted and is being reviewed by our team. We&apos;ll
            activate your account once approved.
          </p>
          {profile?.display_name ? (
            <p className="mt-1 text-xs font-medium text-gray-400 dark:text-white/35">
              Submitted as: {profile.display_name}
            </p>
          ) : null}
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <ActionButton
            className="w-full"
            onClick={handleCheckStatus}
            disabled={checkingStatus}
          >
            {checkingStatus ? "Checking…" : "Check approval status"}
          </ActionButton>
          <ActionButton variant="secondary" className="w-full" onClick={onBack}>
            Back to home
          </ActionButton>
        </div>
      </section>
    );
  }

  /* ---- Profile check failed (NOT the same as having no profile) ---- */
  if (step === "error") {
    return (
      <section className="flex min-h-[55vh] flex-col items-center justify-center gap-6 pb-28 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-9 w-9 text-red-500 dark:text-red-400"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="font-[family:var(--font-display)] text-[1.6rem] font-semibold text-gray-900 dark:text-white">
            Couldn&apos;t load your producer profile
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-gray-500 dark:text-white/55">
            This is a connection problem, not a missing profile — your events,
            posts and followers are all still there. Try again in a moment.
          </p>
          {gateError ? (
            <p className="mt-1 text-xs font-medium text-red-500">{gateError}</p>
          ) : null}
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <ActionButton className="w-full" onClick={() => void runProfileCheck()}>
            Try again
          </ActionButton>
          <ActionButton variant="secondary" className="w-full" onClick={onBack}>
            Back to home
          </ActionButton>
        </div>
      </section>
    );
  }

  /* ---- Onboarding ---- */
  if (step === "onboarding") {
    return (
      <section className="space-y-6 pb-28">
        <div className="pt-1">
          <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Set up your producer profile
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-white/55">
            Tell us about yourself to start creating events and connecting with your audience.
          </p>
        </div>

        <form onSubmit={handleOnboardingSubmit} className="space-y-4">
          <FormField label="Brand / stage name *">
            <input
              type="text"
              value={onboardingName}
              onChange={(e) => setOnboardingName(e.target.value)}
              placeholder="e.g. Soundwave Events"
              className={inputClass}
              style={{ fontSize: "16px" }}
              autoFocus
            />
          </FormField>

          <FormField label="Bio (optional)">
            <textarea
              value={onboardingBio}
              onChange={(e) => setOnboardingBio(e.target.value)}
              placeholder="What kind of events do you produce?"
              rows={3}
              className={inputClass + " resize-none"}
              style={{ fontSize: "16px" }}
            />
          </FormField>

          <FormField label="Instagram handle (optional)">
            <input
              type="text"
              value={onboardingIg}
              onChange={(e) => setOnboardingIg(e.target.value)}
              placeholder="@yourhandle"
              className={inputClass}
              style={{ fontSize: "16px" }}
            />
          </FormField>

          <FormField label="Event types (optional)">
            <div className="flex flex-wrap gap-2">
              {PRODUCER_EVENT_TAGS.map((tag) => {
                const selected = onboardingTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setOnboardingTags((prev) =>
                        selected ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selected
                        ? "border-red-500 bg-red-600 text-white"
                        : "border-gray-300 bg-transparent text-gray-600 dark:border-white/20 dark:text-white/60"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </FormField>

          {onboardingError ? (
            <p className="text-sm text-red-500">{onboardingError}</p>
          ) : null}

          <ActionButton
            type="submit"
            disabled={onboardingBusy || !onboardingName.trim()}
            className="w-full"
          >
            {onboardingBusy ? "Setting up…" : "Create my producer profile"}
          </ActionButton>
        </form>
      </section>
    );
  }

  /* ---- Dashboard ---- */
  if (step === "dashboard") {
    return (
      <section className="space-y-5 pb-36">

        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/60 text-gray-700 transition hover:bg-gray-100 dark:border-white/15 dark:bg-black/25 dark:text-white/80 dark:hover:bg-white/10"
              aria-label="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
              </svg>
            </button>
            <div>
              <h1 className="font-[family:var(--font-display)] text-[1.6rem] font-semibold leading-tight text-gray-900 dark:text-white">
                {displayName}
              </h1>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-white/40">Producer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Audience analytics icon */}
            <button
              type="button"
              onClick={openAudience}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/60 text-gray-600 transition hover:bg-gray-100 dark:border-white/15 dark:bg-black/25 dark:text-white/70 dark:hover:bg-white/10"
              aria-label="Audience analytics"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => { setSettingsLoaded(false); setStep("settings"); }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/60 text-gray-600 transition hover:bg-gray-100 dark:border-white/15 dark:bg-black/25 dark:text-white/70 dark:hover:bg-white/10"
              aria-label="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.672-.356.985-.57.167-.114.335-.125.45-.082l1.019.382a1.875 1.875 0 002.282-.818l.922-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692a1.875 1.875 0 00.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={openEditProfile}
              className="rounded-xl border border-gray-200 bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/15 dark:bg-black/25 dark:text-white/70 dark:hover:bg-white/10"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Events", value: events.length || profile?.total_events_created || 0 },
            { label: "Live", value: profile?.total_events_live || 0 },
            { label: "Followers", value: profile?.follower_count ?? 0 },
            { label: "Avg Going", value: profile?.average_going_count ?? 0 },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-white/85 py-3 dark:border-red-900/40 dark:bg-black/40"
            >
              <span className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-white/40">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Manage Offers nav */}
        <button
          type="button"
          onClick={() => setStep("offers")}
          className="flex w-full items-center justify-between rounded-2xl border border-red-200 bg-white/85 px-4 py-3.5 text-left transition hover:border-red-700/50 dark:border-red-900/40 dark:bg-black/40"
        >
          <span className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 text-red-500">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 12h6M9 16h4" />
            </svg>
            <span className="text-[0.88rem] font-medium text-gray-900 dark:text-white">Manage Offers</span>
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-white/30">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Follower chart */}
        {followerHistory.length > 1 ? (
          <div className="overflow-hidden rounded-2xl border border-red-200 bg-white/85 px-3 pb-2 pt-3 dark:border-red-900/40 dark:bg-black/40">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/40">Followers</p>
              <p className="text-xs font-medium text-amber-400">Last 10 days</p>
            </div>
            <FollowerChart data={followerHistory} />
          </div>
        ) : null}

        {/* Events */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/40">
            Your events
          </p>
          {eventsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-900 border-t-red-500" />
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center dark:border-white/10">
              <p className="text-sm text-gray-500 dark:text-white/40">No events yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events
                .filter((ev, i, arr) => arr.findIndex((e) => e.id === ev.id) === i)
                .map((ev, i) => (
                <button
                  key={ev.id ?? `ev-${i}`}
                  type="button"
                  onClick={() => openEventDetail(ev)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-red-200 bg-white/85 p-3 text-left transition hover:border-red-700/50 dark:border-red-900/40 dark:bg-black/40"
                >
                  {/* Thumbnail / placeholder */}
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-red-900/40">
                    {ev.cover_image_url ? (
                      <img src={ev.cover_image_url} alt={ev.title} className="h-full w-full object-cover" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-red-700/60">
                        <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM8.25 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM9.75 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM10.5 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM12.75 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM14.25 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 13.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                        <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{ev.title}</p>
                    {ev.category ? (
                      <span className="mt-1 inline-block rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-medium text-white">
                        {ev.category}
                      </span>
                    ) : null}
                    {ev.event_date || ev.venue_name ? (
                      <p className="mt-1 truncate text-xs text-gray-500 dark:text-white/40">
                        {[ev.event_date, ev.venue_name].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-white/30">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Posts */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/40">
            Your posts
          </p>
          {postsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-900 border-t-red-500" />
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center dark:border-white/10">
              <p className="text-sm text-gray-500 dark:text-white/40">No posts yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((p, i) => (
                <div
                  key={p.id ?? `post-${i}`}
                  className="rounded-2xl border border-red-200 bg-white/85 p-4 dark:border-red-900/40 dark:bg-black/40"
                >
                  <p className="text-sm leading-relaxed text-gray-700 line-clamp-3 dark:text-white/80">{p.post_text}</p>
                  {(() => {
                    const media = mediaGalleryFor(p.image_url, p.image_urls, p.video_urls);
                    return media.length > 0 ? (
                      <ImageGallery
                        items={media}
                        className="mt-3 overflow-hidden rounded-xl"
                        heightClass="h-40"
                        showThumbnails={false}
                      />
                    ) : null;
                  })()}
                  <div className="mt-2 flex items-center gap-3">
                    {p.created_at ? (
                      <span className="text-xs text-gray-400 dark:text-white/30">
                        {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    ) : null}
                    {typeof p.like_count === "number" && p.like_count > 0 ? (
                      <span className="text-xs text-gray-400 dark:text-white/30">{p.like_count} likes</span>
                    ) : null}
                    {p.id ? (
                      <Link
                        href={`/posts/${p.id}`}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        View post
                      </Link>
                    ) : null}
                    {p.id ? (
                      <button
                        type="button"
                        onClick={() => void handleDeletePost(p.id!)}
                        disabled={postActionBusyId === p.id}
                        className="text-xs font-semibold text-gray-400 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400 disabled:opacity-50"
                      >
                        {postActionBusyId === p.id ? "Deleting…" : "Delete"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAB overlay backdrop */}
        {fabOpen ? (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setFabOpen(false)}
          />
        ) : null}

        {/* Floating Action Button */}
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
          {/* FAB menu */}
          {fabOpen ? (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => { setFabOpen(false); openCreatePost(); }}
                className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-xl backdrop-blur-sm border border-gray-200 whitespace-nowrap dark:bg-black/80 dark:text-white dark:border-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-red-400">
                  <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                </svg>
                Create Post
              </button>
              <button
                type="button"
                onClick={() => { setFabOpen(false); openCreateEvent(); }}
                className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-xl backdrop-blur-sm border border-gray-200 whitespace-nowrap dark:bg-black/80 dark:text-white dark:border-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-red-400">
                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                </svg>
                Create Event
              </button>
            </div>
          ) : null}

          {/* FAB button */}
          <button
            type="button"
            onClick={() => setFabOpen((v) => !v)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_24px_4px_rgba(220,38,38,0.55)] transition-transform active:scale-95"
            style={{ boxShadow: fabOpen ? "0 0 32px 8px rgba(220,38,38,0.7)" : "0 0 24px 4px rgba(220,38,38,0.55)" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-7 w-7 transition-transform duration-200"
              style={{ transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)" }}
            >
              <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </section>
    );
  }

  /* ---- Manage Offers (influencer offer review queue) ---- */
  if (step === "offers") {
    const statusOf = (o: InfluencerOffer) => (o.status ?? "pending").toLowerCase();
    const counts = {
      active: producerOffers.filter((o) => statusOf(o) === "active").length,
      pending: producerOffers.filter((o) => statusOf(o) === "pending").length,
      rejected: producerOffers.filter((o) => statusOf(o) === "rejected").length,
      cancelled: producerOffers.filter((o) => statusOf(o) === "cancelled").length,
    };
    const tabs: Array<{
      key: "active" | "pending" | "rejected" | "cancelled";
      label: string;
    }> = [
      { key: "active", label: "Active" },
      { key: "pending", label: "Pending" },
      { key: "rejected", label: "Rejected" },
      { key: "cancelled", label: "Cancelled" },
    ];
    const filtered = producerOffers.filter(
      (o) => statusOf(o) === producerOfferFilter
    );
    return (
      <section className="space-y-5 pb-28">
        <SectionHeader title="Manage Offers" onBack={() => setStep("dashboard")} />

        {/* Segmented tab bar */}
        <div className="relative flex rounded-full border border-red-200 bg-white/85 p-1 dark:border-red-900/40 dark:bg-black/40">
          <span
            aria-hidden
            className="absolute top-1 bottom-1 rounded-full bg-red-600 transition-transform duration-300 ease-out"
            style={{
              width: "calc((100% - 0.5rem) / 4)",
              left: "0.25rem",
              transform: `translateX(${tabs.findIndex((t) => t.key === producerOfferFilter) * 100}%)`,
            }}
          />
          {tabs.map((tab) => {
            const isActive = producerOfferFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setProducerOfferFilter(tab.key)}
                className={`relative z-10 flex-1 rounded-full px-1 py-1.5 text-[0.72rem] font-semibold transition-colors duration-300 ${
                  isActive ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-white/50"
                }`}
              >
                {tab.label}
                {counts[tab.key] > 0 ? ` (${counts[tab.key]})` : ""}
              </button>
            );
          })}
        </div>

        {isLoadingProducerOffers ? (
          <div className="flex min-h-[6rem] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-900/40 border-t-red-500" />
          </div>
        ) : producerOfferError ? (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[0.8rem] text-red-300">
            {producerOfferError}
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-black/20 px-4 py-3 text-center text-[0.82rem] text-gray-400 dark:text-white/40">
            {producerOfferFilter === "pending"
              ? "No pending requests."
              : producerOfferFilter === "active"
                ? "No active offers."
                : producerOfferFilter === "rejected"
                  ? "No rejected offers."
                  : "No cancelled offers."}
          </p>
        ) : (
          filtered.map((offer) => {
            const status = statusOf(offer);
            const discount = offer.discount_value
              ? offer.discount_type === "percent"
                ? `${offer.discount_value}%`
                : `$${offer.discount_value}`
              : null;
            const isRejecting = rejectingProducerOfferId === offer.id;
            const isBusy = reviewingProducerOfferId === offer.id;
            const cardTone =
              status === "active"
                ? "border-green-500/30 bg-green-500/5"
                : status === "rejected"
                  ? "border-red-500/30 bg-red-500/5"
                  : status === "cancelled"
                    ? "border-white/15 bg-white/5"
                    : "border-amber-500/30 bg-amber-500/5";
            return (
              <div key={offer.id} className={`rounded-2xl border px-4 py-4 ${cardTone}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9rem] font-semibold text-gray-900 dark:text-white">{offer.offer_title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-[0.72rem] capitalize text-gray-500 dark:text-white/50">
                      {offer.offer_type?.replace(/_/g, " ")}
                    </span>
                    {discount ? (
                      <span className="text-[0.72rem] font-semibold text-red-400">
                        {discount} off
                      </span>
                    ) : null}
                  </div>
                  {offer.event_title ? (
                    <p className="mt-1.5 text-[0.78rem] font-medium text-gray-500 dark:text-white/60">
                      For {offer.event_title}
                      {offer.event_date ? ` · ${offer.event_date}` : ""}
                    </p>
                  ) : null}
                  {offer.offer_description ? (
                    <p className="mt-1.5 text-[0.78rem] text-gray-500 dark:text-white/50">
                      {offer.offer_description}
                    </p>
                  ) : null}
                  {offer.promo_code ? (
                    <p className="mt-1.5 text-[0.72rem] font-bold uppercase tracking-wider text-red-400">
                      {offer.promo_code}
                    </p>
                  ) : null}
                  {(status === "rejected" || status === "cancelled") && offer.rejection_reason ? (
                    <p className="mt-1.5 text-[0.72rem] text-red-300">
                      Reason: {offer.rejection_reason}
                    </p>
                  ) : null}
                </div>

                {status === "pending" &&
                  (isRejecting ? (
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        value={producerRejectReason}
                        onChange={(e) => setProducerRejectReason(e.target.value)}
                        placeholder="Reason for rejection (optional)"
                        className={inputClass}
                        style={{ fontSize: "16px" }}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleReviewProducerOffer(
                              offer.id,
                              "reject",
                              producerRejectReason.trim() || undefined
                            )
                          }
                          className="flex-1 rounded-lg border border-red-500 bg-red-600 px-3 py-2 text-[0.78rem] font-semibold text-white disabled:opacity-60"
                        >
                          {isBusy ? "…" : "Confirm Reject"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setRejectingProducerOfferId(null);
                            setProducerRejectReason("");
                          }}
                          className="flex-1 rounded-lg border border-gray-200 dark:border-white/20 px-3 py-2 text-[0.78rem] font-medium text-gray-600 dark:text-white/70"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleReviewProducerOffer(offer.id, "approve")}
                        className="flex-1 rounded-lg border border-green-500 bg-green-600 px-3 py-2 text-[0.78rem] font-semibold text-white disabled:opacity-60"
                      >
                        {isBusy ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectingProducerOfferId(offer.id);
                          setProducerRejectReason("");
                        }}
                        className="flex-1 rounded-lg border border-gray-200 dark:border-white/20 px-3 py-2 text-[0.78rem] font-medium text-gray-600 dark:text-white/70"
                      >
                        Reject
                      </button>
                    </div>
                  ))}

                {status === "active" &&
                  (isRejecting ? (
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        value={producerRejectReason}
                        onChange={(e) => setProducerRejectReason(e.target.value)}
                        placeholder="Reason for cancelling (optional)"
                        className={inputClass}
                        style={{ fontSize: "16px" }}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleReviewProducerOffer(
                              offer.id,
                              "cancel",
                              producerRejectReason.trim() || undefined
                            )
                          }
                          className="flex-1 rounded-lg border border-red-500 bg-red-600 px-3 py-2 text-[0.78rem] font-semibold text-white disabled:opacity-60"
                        >
                          {isBusy ? "…" : "Confirm Cancel"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setRejectingProducerOfferId(null);
                            setProducerRejectReason("");
                          }}
                          className="flex-1 rounded-lg border border-gray-200 dark:border-white/20 px-3 py-2 text-[0.78rem] font-medium text-gray-600 dark:text-white/70"
                        >
                          Keep Active
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectingProducerOfferId(offer.id);
                          setProducerRejectReason("");
                        }}
                        className="w-full rounded-lg border border-gray-200 dark:border-white/20 px-3 py-2 text-[0.78rem] font-medium text-gray-600 dark:text-white/70"
                      >
                        Cancel Offer
                      </button>
                    </div>
                  ))}
              </div>
            );
          })
        )}

        {producerOfferMessage ? (
          <p
            className={`text-sm ${
              /could ?n[o']?t|failed|error|required|not found|unable/i.test(producerOfferMessage)
                ? "text-red-400"
                : "text-green-400"
            }`}
          >
            {producerOfferMessage}
          </p>
        ) : null}
      </section>
    );
  }

  /* ---- Create / Edit event ---- */
  if (step === "create-event" || step === "edit-event") {
    const isEdit = step === "edit-event";
    return (
      <section className="space-y-5 pb-28">
        <SectionHeader
          title={isEdit ? "Edit event" : "Create event"}
          onBack={() => setStep("dashboard")}
        />

        <form onSubmit={handleEventSubmit} className="space-y-4">
          <FormField label="Event title *" error={evFieldErrors.title}>
            <input
              type="text"
              value={evTitle}
              onChange={(e) => setEvTitle(e.target.value)}
              placeholder="e.g. Summer Night Live"
              maxLength={100}
              className={inputClass}
              style={{ fontSize: "16px" }}
              autoFocus={!isEdit}
            />
          </FormField>

          <FormField label="Category *" error={evFieldErrors.category}>
            <select
              value={evCategory}
              onChange={(e) => setEvCategory(e.target.value)}
              className={inputClass}
              style={{ fontSize: "16px" }}
            >
              <option value="">Select a category…</option>
              {EVENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Description">
            <textarea
              value={evDescription}
              onChange={(e) => setEvDescription(e.target.value)}
              placeholder="Describe your event…"
              rows={3}
              maxLength={1000}
              className={inputClass + " resize-none"}
              style={{ fontSize: "16px" }}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date *" error={evFieldErrors.date}>
              <input
                type="date"
                value={evDate}
                onChange={(e) => setEvDate(e.target.value)}
                min={todayDateStr()}
                className={inputClass}
                style={{ fontSize: "16px" }}
              />
            </FormField>
            <FormField label="Start time *" error={evFieldErrors.startTime}>
              <input
                type="time"
                value={evStartTime}
                onChange={(e) => setEvStartTime(e.target.value)}
                className={inputClass}
                style={{ fontSize: "16px" }}
              />
            </FormField>
          </div>

          <FormField label="End time" error={evFieldErrors.endTime}>
            <input
              type="time"
              value={evEndTime}
              onChange={(e) => setEvEndTime(e.target.value)}
              className={inputClass}
              style={{ fontSize: "16px" }}
            />
          </FormField>

          <FormField label="Venue">
            {evVenueId && !evVenueManual ? (
              /* Selected venue chip */
              <div className="flex items-center justify-between rounded-xl border border-red-400/50 bg-red-50/50 px-3 py-2.5 dark:border-red-500/40 dark:bg-red-900/10">
                <span className="text-[0.9rem] font-medium text-gray-900 dark:text-white">{evVenue}</span>
                <button
                  type="button"
                  onClick={() => { setEvVenue(""); setEvVenueId(null); setEvVenueQuery(""); setEvVenueResults([]); }}
                  className="ml-2 text-gray-400 hover:text-red-500 dark:text-white/40"
                >
                  ✕
                </button>
              </div>
            ) : evVenueManual ? (
              /* Manual text entry fallback */
              <div className="space-y-2">
                <input
                  type="text"
                  value={evVenue}
                  onChange={(e) => setEvVenue(e.target.value)}
                  placeholder="e.g. The Woodlands Pavilion"
                  className={inputClass}
                  style={{ fontSize: "16px" }}
                />
                <button
                  type="button"
                  onClick={() => { setEvVenueManual(false); setEvVenue(""); setEvVenueId(null); }}
                  className="text-[0.78rem] text-red-500 hover:underline"
                >
                  ← Search venues instead
                </button>
              </div>
            ) : (
              /* Venue search */
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={evVenueQuery}
                    onChange={(e) => setEvVenueQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleVenueSearch(); } }}
                    placeholder="Search venue name..."
                    className={inputClass}
                    style={{ fontSize: "16px" }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleVenueSearch()}
                    disabled={evVenueSearching || !evVenueQuery.trim()}
                    className="rounded-xl border border-[#E7070380] px-3 py-2 text-[0.8rem] font-medium text-red-600 disabled:opacity-40 dark:text-red-400"
                  >
                    {evVenueSearching ? "…" : "Search"}
                  </button>
                </div>
                {evVenueResults.length > 0 && (
                  <div className="space-y-0.5 rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-black/40">
                    {evVenueResults.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => { setEvVenue(v.venue_name); setEvVenueId(Number(v.id)); setEvVenueQuery(""); setEvVenueResults([]); }}
                        className="w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <p className="text-[0.88rem] font-medium text-gray-900 dark:text-white">{v.venue_name}</p>
                        {v.address && <p className="text-[0.75rem] text-gray-400 dark:text-white/40">{v.address}</p>}
                      </button>
                    ))}
                  </div>
                )}
                {evVenueResults.length === 0 && evVenueQuery.trim() && !evVenueSearching && (
                  <p className="text-[0.78rem] text-gray-400 dark:text-white/40">No venues found.</p>
                )}
                <button
                  type="button"
                  onClick={() => setEvVenueManual(true)}
                  className="text-[0.78rem] text-gray-400 hover:text-red-500 dark:text-white/40"
                >
                  + Add venue manually
                </button>
              </div>
            )}
          </FormField>

          <FormField label="City">
            <input
              type="text"
              value={evCity}
              onChange={(e) => setEvCity(e.target.value)}
              placeholder="e.g. Houston"
              className={inputClass}
              style={{ fontSize: "16px" }}
            />
          </FormField>

          <FormField label="Ticket / RSVP link">
            <input
              type="url"
              value={evTicketUrl}
              onChange={(e) => setEvTicketUrl(e.target.value)}
              placeholder="https://…"
              className={inputClass}
              style={{ fontSize: "16px" }}
            />
          </FormField>

          <FormField label="Photos">
            <ImageUploader
              mode="multi"
              max={Math.max(0, 5 - evVideos.length)}
              folder="events"
              value={evImageUrls}
              onChange={setEvImageUrls}
              onUploadingChange={setEvUploading}
            />
            <p className="mt-1.5 text-[11px] text-gray-400 dark:text-white/40">
              Up to 5 photos and videos combined. The first one is used as the event cover.
            </p>
          </FormField>

          <FormField label="Videos">
            <VideoUploader
              value={evVideos}
              onChange={setEvVideos}
              folder="events"
              max={Math.max(0, 5 - evImageUrls.length)}
              onUploadingChange={setEvVideoUploading}
            />
          </FormField>

          {evError ? (
            <p className="text-sm text-red-500">{evError}</p>
          ) : null}

          <div className="flex gap-3">
            <ActionButton
              variant="secondary"
              className="flex-1"
              onClick={() => setStep("dashboard")}
            >
              Cancel
            </ActionButton>
            <ActionButton
              type="submit"
              className="flex-1"
              disabled={evBusy || evUploading || evVideoUploading}
            >
              {evUploading || evVideoUploading
                ? "Uploading…"
                : evBusy
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Create event"}
            </ActionButton>
          </div>
        </form>
      </section>
    );
  }

  /* ---- Event detail + analytics ---- */
  if (step === "event-detail" && selectedEvent) {
    const hasTicket = Boolean(selectedEvent.ticket_url);
    const timeRange = formatTimeRange(selectedEvent.start_time, selectedEvent.end_time);
    const formattedDate = formatEventDate(selectedEvent.event_date);
    const timeLine = [timeRange, formattedDate].filter(Boolean).join("  ·  ");
    const venueLine2 = [selectedEvent.venue_address, selectedEvent.city].filter(Boolean).join(", ");
    const longDesc = (selectedEvent.description ?? "").length > 180;
    const eventMedia = mediaGalleryFor(selectedEvent.cover_image_url, selectedEvent.image_urls, selectedEvent.video_urls);

    return (
      <section className="pb-28">

        {/* ── Hero image ─────────────────────────────────────── */}
        <div className="relative -mx-4 h-60 overflow-hidden bg-gradient-to-b from-red-950 to-black">
          {eventMedia.length > 0 ? (
            <ImageGallery
              items={eventMedia}
              alt={selectedEvent.title}
              heightClass="h-60"
              showThumbnails={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-20 w-20 text-red-900/60">
                <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {/* Bottom gradient overlay — must not swallow the gallery's arrow taps */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />

          {/* Back button */}
          <button
            type="button"
            onClick={() => setStep("dashboard")}
            className="absolute left-4 top-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
            aria-label="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* ── Content ────────────────────────────────────────── */}
        <div className="space-y-5 pt-5">

          {/* Title */}
          <h1 className="font-[family:var(--font-display)] text-2xl font-bold leading-tight text-gray-900 dark:text-white">
            {selectedEvent.title}
          </h1>

          {/* Meta rows */}
          <div className="space-y-2.5">
            {timeLine ? (
              <div className="flex items-start gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                </svg>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-white/70">{timeLine}</p>
              </div>
            ) : null}

            {(selectedEvent.venue_name || venueLine2) ? (
              <div className="flex items-start gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500">
                  <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C14.97 15.234 16.5 13.005 16.5 10c0-3.866-3.134-7-7-7S2.5 6.134 2.5 10c0 3.004 1.529 5.234 3.154 6.585a12.977 12.977 0 002.274 1.765 9.236 9.236 0 00.757.433 5.75 5.75 0 00.281.14l.018.008.006.003zM10 11.25a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" clipRule="evenodd" />
                </svg>
                <div>
                  {selectedEvent.venue_name ? (
                    <p className="text-sm text-gray-600 dark:text-white/70">{selectedEvent.venue_name}</p>
                  ) : null}
                  {venueLine2 ? (
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-white/40">{venueLine2}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Tag pills */}
          {(selectedEvent.category || selectedEvent.age_requirement || selectedEvent.is_free !== undefined || selectedEvent.ticket_price_min !== undefined) ? (
            <div className="flex flex-wrap items-center gap-2">
              {selectedEvent.category ? (
                <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                  {selectedEvent.category}
                </span>
              ) : null}
              {selectedEvent.is_free ? (
                <span className="rounded-full border border-green-500/40 px-3 py-1 text-xs font-medium text-green-400">
                  Free
                </span>
              ) : selectedEvent.ticket_price_min !== undefined ? (
                <span className="rounded-full border border-gray-200 dark:border-white/20 px-3 py-1 text-xs text-gray-500 dark:text-white/60">
                  From ${selectedEvent.ticket_price_min}
                </span>
              ) : null}
              {selectedEvent.age_requirement ? (
                <span className="rounded-full border border-gray-200 dark:border-white/20 px-3 py-1 text-xs text-gray-500 dark:text-white/60">
                  {selectedEvent.age_requirement}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="flex gap-3">
            {hasTicket ? (
              <a
                href={selectedEvent.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-600 py-3 text-sm font-semibold text-white shadow-[0_0_16px_2px_rgba(220,38,38,0.35)] transition hover:bg-red-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
                </svg>
                Buy Tickets
              </a>
            ) : null}
            <button
              type="button"
              onClick={handleShare}
              className={`flex items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-white/20 py-3 text-sm font-semibold text-gray-700 dark:text-white/80 transition hover:border-gray-300 dark:hover:border-white/40 ${hasTicket ? "px-5" : "flex-1"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
              </svg>
              Share
            </button>
            <button
              type="button"
              onClick={() => openEditEvent(selectedEvent)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-white/20 px-5 py-3 text-sm font-semibold text-gray-700 dark:text-white/80 transition hover:border-gray-300 dark:hover:border-white/40"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
              Edit
            </button>
            {selectedEvent.status !== "cancelled" ? (
              <button
                type="button"
                onClick={() => void handleCancelEvent(selectedEvent.id)}
                disabled={eventActionBusy}
                className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-900/40 px-5 py-3 text-sm font-semibold text-red-600 dark:text-red-400 transition hover:border-red-300 disabled:opacity-50"
              >
                {eventActionBusy ? "Cancelling…" : "Cancel event"}
              </button>
            ) : (
              <span className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-white/15 px-5 py-3 text-sm font-semibold text-gray-400 dark:text-white/40">
                Cancelled
              </span>
            )}
          </div>

          {eventActionError ? (
            <p className="text-sm text-red-500">{eventActionError}</p>
          ) : null}

          {/* Description */}
          {selectedEvent.description ? (
            <div className="rounded-2xl border border-gray-100 dark:border-white/8 bg-white/85 dark:bg-black/30 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/40">Event Details</p>
              <p className={`text-sm leading-relaxed text-gray-600 dark:text-white/70 ${descriptionExpanded ? "" : "line-clamp-4"}`}>
                {selectedEvent.description}
              </p>
              {longDesc ? (
                <button
                  type="button"
                  onClick={() => setDescriptionExpanded((v) => !v)}
                  className="mt-2 text-sm font-medium text-red-400"
                >
                  {descriptionExpanded ? "Show less" : "Read more…"}
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Analytics */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/40">Analytics</p>
            {eventAnalytics ? (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "RSVPs", value: eventAnalytics.rsvp_count ?? 0 },
                  { label: "Views", value: eventAnalytics.view_count ?? 0 },
                  { label: "Saves", value: eventAnalytics.save_count ?? 0 },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-white/85 py-4 dark:border-red-900/40 dark:bg-black/40"
                  >
                    <span className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</span>
                    <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-white/40">{s.label}</span>
                  </div>
                ))}
              </div>
            ) : eventAnalyticsError ? (
              <p className="text-sm text-gray-400 dark:text-white/30">Analytics unavailable right now.</p>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-900 border-t-red-500" />
              </div>
            )}
          </div>

          {/* RSVP list */}
          {rsvpList.length > 0 ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/40">
                RSVPs ({rsvpList.length})
              </p>
              <div className="space-y-2">
                {rsvpList.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-2xl border border-red-100 bg-white/85 px-4 py-3 dark:border-red-900/20 dark:bg-black/30"
                  >
                    <span className="text-sm text-gray-600 dark:text-white/70">
                      {r.first_name ?? ""} {r.last_name ?? ""}
                      {!r.first_name && !r.last_name ? r.email ?? "Guest" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

        </div>
      </section>
    );
  }

  /* ---- Audience analytics ---- */
  if (step === "audience") {
    return (
      <section className="space-y-5 pb-28">
        <SectionHeader
          title="Audience analytics"
          onBack={() => setStep("dashboard")}
        />

        {audienceAnalyticsError ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center dark:border-white/15">
            <p className="text-sm text-gray-500 dark:text-white/50">
              Audience analytics unavailable right now.
            </p>
          </div>
        ) : audienceAnalytics ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Followers" value={audienceAnalytics.follower_count ?? 0} />
              <StatCard label="Going" value={audienceAnalytics.total_going ?? 0} />
              <StatCard label="Events" value={audienceAnalytics.total_events ?? 0} />
              <StatCard label="Views" value={audienceAnalytics.total_views ?? 0} />
            </div>

            {Array.isArray(audienceAnalytics.cities) && audienceAnalytics.cities.length > 0 ? (
              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">
                  Top cities
                </p>
                <div className="space-y-2">
                  {audienceAnalytics.cities.map((c) => (
                    <div
                      key={c.city}
                      className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-black/20"
                    >
                      <span className="text-sm text-gray-800 dark:text-white/80">{c.city}</span>
                      <span className="text-sm font-semibold text-gray-700 dark:text-white/70">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
          </div>
        )}
      </section>
    );
  }

  /* ---- Create post ---- */
  if (step === "create-post") {
    const initials = (profile?.display_name ?? displayName)
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const todayLabel = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    return (
      <section className="flex min-h-[80vh] flex-col pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 pb-5 pt-1">
          <button
            type="button"
            onClick={() => setStep("dashboard")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/60 text-gray-700 transition hover:bg-gray-100 dark:border-white/15 dark:bg-black/25 dark:text-white/80 dark:hover:bg-white/10"
            aria-label="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="flex-1 text-center font-[family:var(--font-display)] text-xl font-semibold text-gray-900 dark:text-white">
            Create Post
          </h1>
          {/* spacer to keep title centred */}
          <div className="h-9 w-9" />
        </div>

        {postSuccess ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-900/40 dark:bg-green-900/20">
              <p className="font-semibold text-green-700 dark:text-green-400">Post published!</p>
              <p className="mt-1 text-sm text-green-600 dark:text-green-500/80">Your post is now live.</p>
            </div>
            <ActionButton className="w-full" onClick={() => setStep("dashboard")}>
              Back to dashboard
            </ActionButton>
          </div>
        ) : (
          <form onSubmit={handlePostSubmit} className="flex flex-1 flex-col gap-5">
            {/* Producer identity row */}
            <div className="flex items-center gap-3">
              {profile?.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt={displayName}
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
                  {initials}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{displayName}</p>
                <p className="text-xs text-gray-400 dark:text-white/40">{todayLabel}</p>
              </div>
            </div>

            {/* Text area */}
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="What's on your mind?"
              rows={6}
              maxLength={POST_TEXT_MAX}
              className="w-full flex-1 resize-none rounded-2xl border border-gray-200 bg-transparent px-4 py-4 text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none dark:border-white/15 dark:text-white dark:placeholder:text-white/30 dark:focus:border-red-500/60"
              style={{ fontSize: "16px" }}
              autoFocus
            />
            {postError ? (
              <p className="text-sm text-red-500">{postError}</p>
            ) : null}

            {/* Photo picker (shown when the image icon is tapped, or once photos exist) */}
            {postShowImageInput || postImageUrls.length > 0 ? (
              <ImageUploader
                mode="multi"
                max={Math.max(0, 5 - postVideos.length)}
                folder="posts"
                value={postImageUrls}
                onChange={setPostImageUrls}
                onUploadingChange={setPostUploading}
              />
            ) : null}

            {/* Video picker (same toggle-or-already-has-content pattern as photos) */}
            {postShowImageInput || postVideos.length > 0 ? (
              <VideoUploader
                value={postVideos}
                onChange={setPostVideos}
                folder="posts"
                max={Math.max(0, 5 - postImageUrls.length)}
                onUploadingChange={setPostVideoUploading}
              />
            ) : null}

            {/* Add to post bar */}
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 dark:border-white/15">
              <span className="text-sm text-gray-400 dark:text-white/35">Add to your post</span>
              <div className="flex items-center gap-3">
                {/* Location icon — placeholder, not wired to endpoint yet */}
                <button type="button" className="text-red-500 dark:text-red-400" aria-label="Add location">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                    <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.003 3.5-4.697 3.5-8.327a8 8 0 10-16 0c0 3.63 1.556 6.326 3.5 8.327a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </button>
                {/* Image icon — toggles URL input */}
                <button
                  type="button"
                  onClick={() => setPostShowImageInput((v) => !v)}
                  className={postShowImageInput ? "text-red-600 dark:text-red-400" : "text-red-500 dark:text-red-400"}
                  aria-label="Add image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                    <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Post It button */}
            <button
              type="submit"
              disabled={postBusy || postUploading || postVideoUploading || !postText.trim()}
              className="w-full rounded-2xl bg-gradient-to-r from-red-700 to-red-500 py-4 text-base font-semibold text-white shadow-lg transition hover:from-red-600 hover:to-red-400 disabled:opacity-50"
            >
              {postUploading || postVideoUploading ? "Uploading…" : postBusy ? "Publishing…" : "Post It"}
            </button>
          </form>
        )}
      </section>
    );
  }

  /* ---- Edit profile ---- */
  if (step === "edit-profile") {
    return (
      <section className="space-y-5 pb-28">
        <SectionHeader
          title="Edit profile"
          onBack={() => setStep("dashboard")}
        />

        <form onSubmit={handleProfileSave} className="space-y-4">
          <FormField label="Producer photo">
            <ImageUploader
              mode="single"
              shape="circle"
              folder="avatars"
              value={profPhotoUrls}
              onChange={setProfPhotoUrls}
              onUploadingChange={setProfPhotoUploading}
            />
            <p className="mt-1.5 text-center text-[11px] text-gray-400 dark:text-white/40">
              Shown on your producer profile, posts, and events — separate from your personal account photo.
            </p>
          </FormField>

          <FormField label="Display name *">
            <input
              type="text"
              value={profName}
              onChange={(e) => setProfName(e.target.value)}
              placeholder="Brand / stage name"
              className={inputClass}
              style={{ fontSize: "16px" }}
              autoFocus
            />
          </FormField>

          <FormField label="Bio">
            <textarea
              value={profBio}
              onChange={(e) => setProfBio(e.target.value)}
              placeholder="Tell your audience about you…"
              rows={3}
              className={inputClass + " resize-none"}
              style={{ fontSize: "16px" }}
            />
          </FormField>

          <FormField label="Instagram handle">
            <input
              type="text"
              value={profIg}
              onChange={(e) => setProfIg(e.target.value)}
              placeholder="@yourhandle"
              className={inputClass}
              style={{ fontSize: "16px" }}
            />
          </FormField>

          <FormField label="Event types (optional)">
            <div className="flex flex-wrap gap-2">
              {PRODUCER_EVENT_TAGS.map((tag) => {
                const selected = profTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setProfTags((prev) =>
                        selected ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selected
                        ? "border-red-500 bg-red-600 text-white"
                        : "border-gray-300 bg-transparent text-gray-600 dark:border-white/20 dark:text-white/60"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </FormField>

          {profError ? (
            <p className="text-sm text-red-500">{profError}</p>
          ) : null}

          <div className="flex gap-3">
            <ActionButton
              variant="secondary"
              className="flex-1"
              onClick={() => setStep("dashboard")}
            >
              Cancel
            </ActionButton>
            <ActionButton
              type="submit"
              className="flex-1"
              disabled={profBusy || profPhotoUploading || !profName.trim()}
            >
              {profBusy ? "Saving…" : profPhotoUploading ? "Uploading photo…" : "Save profile"}
            </ActionButton>
          </div>
        </form>
      </section>
    );
  }

  /* ---- Settings ---- */
  if (step === "settings") {
    const NOTIF_TOGGLES: { key: keyof typeof settingsForm; label: string }[] = [
      { key: "notify_new_follower",       label: "New follower" },
      { key: "notify_post_like",          label: "Post liked" },
      { key: "notify_post_comment",       label: "Post commented" },
      { key: "notify_going_match",        label: "Friend going to same event" },
      { key: "notify_venue_energy_alert", label: "Venue energy alerts" },
      { key: "notify_event_reminder",     label: "Event reminders" },
      { key: "notify_promoter_new_event", label: "New event from followed producer" },
      { key: "notify_new_message",        label: "New messages" },
      { key: "notify_genie_alerts",       label: "Genie platform alerts" },
    ];

    return (
      <section className="space-y-6 pb-28">
        <SectionHeader title="Notification settings" onBack={() => setStep("dashboard")} />

        <form onSubmit={handleSettingsSave} className="space-y-3">
          {NOTIF_TOGGLES.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white/60 px-4 py-3.5 dark:border-white/10 dark:bg-black/20"
            >
              <span className="text-sm text-gray-800 dark:text-white/80">{label}</span>
              <button
                type="button"
                onClick={() => setSettingsForm((f) => ({ ...f, [key]: !f[key] }))}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                  settingsForm[key] ? "bg-red-600" : "bg-gray-300 dark:bg-white/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    settingsForm[key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}

          {settingsMessage ? (
            <p className={`text-sm ${settingsMessage.includes("saved") ? "text-green-500" : "text-red-500"}`}>
              {settingsMessage}
            </p>
          ) : null}

          <ActionButton type="submit" className="w-full" disabled={isSavingSettings}>
            {isSavingSettings ? "Saving…" : "Save settings"}
          </ActionButton>
        </form>
      </section>
    );
  }

  return null;
}
