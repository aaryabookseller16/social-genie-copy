"use client";

import Image from "next/image";
import {
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { trackEvent } from "@/app/lib/analytics";
import { analyticsEvents } from "@/app/lib/analyticsEvents";
import { type RuntimeConfig } from "@/app/lib/genieTypes";
import { type GenieVenue } from "@/app/lib/genieClient";
import { type ConsumerAccount, readConsumerAccount, writeConsumerAccount } from "@/app/lib/localState";
import {
  createSubscriptionCheckout,
  createVendorBusiness,
  createVendorOffer,
  createProducerEvent,
  createProducerPost,
  cancelProducerEvent,
  updateProducerPost,
  deleteProducerPost,
  fetchMyEvents,
  fetchMyPosts,
  fetchMyVendorProfile,
  fetchVendorAnalytics,
  fetchVendorDashboard,
  fetchVendorInfluencerCodes,
  fetchVendorNotifPrefs,
  fetchVendorInfluencerOffers,
  fetchVendorVenue,
  fetchVenueImages,
  reviewInfluencerOffer,
  saveVenueImages,
  searchVendorBusinesses,
  updateVendorNotifPrefs,
  updateVendorProfile,
  updateVendorVenue,
  vendorOnboardingSearch,
  vendorOnboardingContact,
  vendorOnboardingConfirm,
  type InfluencerOffer,
  type VendorInfluencerCode,
  type VendorAnalyticsTotals,
  type VendorAnalyticsDailyRecord,
  type ProducerEvent,
  type ProducerPost,
  type VideoItem,
} from "@/app/lib/publicApiClient";
import { readExternalUserId } from "@/app/lib/sessionToken";
import {
  readVendorDraft,
  writeVendorDraft,
  clearVendorDraft,
} from "@/app/lib/vendorOnboarding";
import { galleryFor } from "@/app/lib/image";

import ImageUploader from "@/app/components/ImageUploader";
import VideoUploader, { type VideoSlotValue } from "@/app/components/VideoUploader";
import { ActionButton } from "./ui";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** The offer_type enum Xano's genie_offers table accepts. */
type VendorOfferType = Parameters<typeof createVendorOffer>[0]["offer_type"];

const VENDOR_OFFER_TYPES: VendorOfferType[] = [
  "happy_hour",
  "brunch",
  "perk",
  "weekly_special",
  "drink_special",
  "food_special",
  "event_access",
  "vip_only",
  "limited_time",
  "experience",
  "group_offer",
  "late_night",
  "other",
];

const OFFER_TITLE_MAX = 100;
const OFFER_DESCRIPTION_MAX = 500;
const POST_TEXT_MAX = 2000;

type VendorStep =
  | "loading"
  | "claim"
  | "finding"
  | "not-found"
  | "match"
  | "contact"
  | "photos"
  | "location"
  | "plan"
  | "success"
  | "manual-info"
  | "manual-location"
  | "manual-profile"
  | "manual-contact"
  | "dashboard"
  | "profile"
  | "analytics"
  | "offers"
  | "create-offer"
  | "boost"
  | "influencer-codes"
  | "settings"
  | "my-content"
  | "create-event"
  | "create-post";

type VendorContactState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type ManualBusinessInfo = {
  businessName: string;
  category: string;
  cuisine: string;
  phone: string;
  website: string;
  reservationUrl: string;
  instagram: string;
};

type ManualLocationInfo = {
  address: string;
  city: string;
  state: string;
  zip: string;
  neighborhood: string;
};

type ManualProfileInfo = {
  shortDescription: string;
  priceBand: string;
  music: string;
  hookah: string;
  happyHour: string;
};

type ManualContactInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleTitle: string;
};

type FullDashboardData = {
  vendor_id: number;
  business_name: string;
  email: string;
  plan_selected: string;
  is_live: boolean;
  plan_selected_at: number;
  onboarding_completed: boolean;
  is_pro: boolean;
  offers: Array<{
    id: number;
    title: string;
    offer_type: string;
    member_only?: boolean;
    active?: boolean;
    redeem_instructions?: string | null;
    schedule_json?: Record<string, unknown> | null;
  }>;
  offer_count: number;
  // ── Optional fields surfaced in the new dashboard design ────────────
  // These are tolerated as undefined; the UI defaults to 0/"—" until the
  // backend starts returning them.
  rating?: number;
  address?: string | null;
  logo_url?: string;
  is_claimed?: boolean;
  // Stat totals. These names are exactly what vendor_dashboard_v1 returns — they
  // are NOT free to rename. They previously read genie_appearances / profile_views /
  // total_customer_actions / call_clicks / map_clicks / reservation_clicks /
  // user_saved, none of which Xano sends, so every stat silently rendered 0.
  total_genie_appearances: number;
  total_profile_views: number;
  total_actions: number;
  total_call_clicks: number;
  total_map_clicks: number;
  total_reservation_clicks: number;
  total_saves: number;
  engagement_rate?: number;
  // Not returned by vendor_dashboard_v1 — the chart falls back to placeholder
  // data when absent. See the Analytics step for the real per-day series.
  performance_points?: Array<{ label?: string; value: number }>;
  performance_min?: number;
  // Business details
  website?: string | null;
  website_url?: string | null;
  reservation_url?: string | null;
  category?: string;
  cuisine?: string;
  instagram?: string;
  // Venue details surfaced in Edit Profile form
  description?: string | null;
  vibe_notes?: string | null;
  phone?: string | null;
  hours_text?: string | null;
  image_primary_url?: string | null;
  // Boost status (Pro)
  boost_active?: boolean;
  boost_amount?: number;
  boost_period_label?: string;
  // Dashboard widgets (offer_count is already declared above, non-optional)
  checkins_today?: number;
  is_open_now?: boolean | null;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isEmailValid(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

const EVENT_CATEGORIES = [
  "Concert",
  "Club Night",
  "Day Party",
  "Comedy",
  "Art & Culture",
  "Sports",
  "Food & Drink",
  "Festival",
  "Networking",
  "Private Event",
  "Other",
];

function formatEventTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatEventTimeRange(start?: string, end?: string): string {
  if (!start && !end) return "";
  if (start && end) return `${formatEventTime(start)} – ${formatEventTime(end)}`;
  return start ? formatEventTime(start) : end ? formatEventTime(end) : "";
}

function formatEventDateLabel(dateStr?: string): string {
  if (!dateStr) return "";
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.toLocaleDateString("en-US", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function isUrlValid(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isPhoneValid(value: string) {
  return /^[\d\s()+-]{7,20}$/.test(value);
}

const CONTACT_NAME_MAX = 60;

/** Local (not UTC) today as YYYY-MM-DD, comparable against a `<input type="date">` value. */
function todayDateStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Xano tag fields come back as arrays, objects keyed by tag, or strings.
// Flatten to a comma-separated label, or "" when empty.
function formatTagRecord(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === "string").join(", ");
  }
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).filter(
      (k) => (value as Record<string, unknown>)[k]
    );
    return keys.join(", ");
  }
  return "";
}

function createContactState(
  account: ConsumerAccount | null
): VendorContactState {
  return {
    firstName: account?.firstName ?? "",
    lastName: account?.lastName ?? "",
    email: account?.email ?? "",
    phone: account?.phone ?? "",
  };
}

function getVenueId(venue: GenieVenue) {
  return String(venue.id);
}

function tierLabel(planTier: string) {
  return planTier === "pro" ? "PRO" : "Basic";
}

function renderStars(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.3;
  const stars: string[] = [];
  for (let i = 0; i < full; i++) stars.push("★");
  if (half) stars.push("½");
  return stars.join("");
}

/* ------------------------------------------------------------------ */
/*  Small presentational pieces                                        */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  icon,
  locked,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  locked?: boolean;
}) {
  if (locked) return null;
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#E7070380] bg-gray-50 px-3 py-5 dark:border-[#E7070380] dark:bg-black/20">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-[#ff7b7b]">
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value.toLocaleString()}
      </p>
      <p className="text-[13px] text-gray-500 dark:text-white/55">{label}</p>
    </div>
  );
}

/* ── Dashboard-specific presentational pieces (Free + Paid) ────────── */

function BigStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-[#E7070380] bg-white px-3 py-4 text-center dark:bg-black/30">
      <p className="text-[1.75rem] font-bold leading-none text-gray-900 dark:text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="mt-1.5 text-[0.72rem] leading-tight text-gray-500 dark:text-white/60">
        {label}
      </p>
    </div>
  );
}

function MicroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] border border-[#E7070380] bg-white px-2 py-3 text-center dark:bg-black/30">
      <p className="text-[1.25rem] font-bold leading-none text-gray-900 dark:text-white">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[0.65rem] leading-tight text-gray-500 dark:text-white/60">
        {label}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  withDivider,
}: {
  label: string;
  value?: string | null;
  withDivider?: boolean;
}) {
  return (
    <div
      className={`py-3 ${
        withDivider ? "border-t border-red-200/60 dark:border-white/10" : ""
      }`}
    >
      <p className="text-[12px] font-medium uppercase tracking-wide text-gray-400 dark:text-white/55">
        {label}
      </p>
      <p className="mt-0.5 break-words text-[15px] font-medium text-gray-900 dark:text-white">
        {value || "—"}
      </p>
    </div>
  );
}

function PerformanceChart({
  points,
  minLabel = "0%",
  headLabel = "7 Days",
}: {
  points: Array<{ value: number }>;
  minLabel?: string;
  headLabel?: string;
}) {
  const width = 320;
  const height = 140;
  const paddingX = 10;
  const paddingY = 20;
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step =
    points.length > 1 ? (width - paddingX * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = paddingX + i * step;
    const y =
      paddingY +
      (height - paddingY * 2) * (1 - (p.value - min) / range);
    return { x, y };
  });

  // Smooth curve via simple Catmull-Rom style interpolation.
  const path = coords
    .map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`))
    .join(" ");

  const last = coords[coords.length - 1];

  return (
    <div className="relative mt-2 w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        {/* dashed guide through the highest point */}
        {coords.length > 0 ? (
          <line
            x1={paddingX}
            x2={width - paddingX}
            y1={coords.reduce(
              (min, c) => (c.y < min ? c.y : min),
              coords[0].y
            )}
            y2={coords.reduce(
              (min, c) => (c.y < min ? c.y : min),
              coords[0].y
            )}
            stroke="rgba(255,255,255,0.18)"
            strokeDasharray="3 4"
            strokeWidth="1"
          />
        ) : null}
        {/* the main curve */}
        <path
          d={path}
          fill="none"
          stroke="#e8900a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* dots */}
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={3}
            fill="#e8900a"
            stroke="#2a0707"
            strokeWidth="1"
          />
        ))}
      </svg>
      {/* annotations */}
      {last ? (
        <span className="absolute right-2 top-0 text-[13px] font-semibold text-[#e8900a]">
          {headLabel}
        </span>
      ) : null}
      <span className="absolute bottom-5 left-0 text-[13px] font-semibold text-white/70 dark:text-white/70">
        {minLabel}
      </span>
    </div>
  );
}

function ProgressBar({ step }: { step: number }) {
  const total = 4;
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={`pb-${i}`}
          className={`h-[3px] flex-1 rounded-full ${
            i < step ? "bg-red-600" : "bg-gray-200 dark:bg-white/12"
          }`}
        />
      ))}
    </div>
  );
}

function VendorInput({
  value,
  placeholder,
  type = "text",
  onChange,
  label,
  maxLength,
  error,
}: {
  value: string;
  placeholder: string;
  type?: string;
  onChange: (v: string) => void;
  label?: string;
  maxLength?: number;
  error?: string;
}) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
      />
      {error ? <p className="mt-1.5 text-[0.78rem] text-red-500">{error}</p> : null}
    </div>
  );
}

/**
 * Venue photos, up to 5, first one is the main photo. Optional everywhere —
 * a vendor can skip this and add photos later from the dashboard.
 */
function VenuePhotoPicker({
  photos,
  onChange,
  onUploadingChange,
  label = "Photos",
}: {
  photos: string[];
  onChange: (urls: string[]) => void;
  onUploadingChange?: (busy: boolean) => void;
  label?: string;
}) {
  return (
    <div>
      <ImageUploader
        mode="multi"
        max={5}
        folder="venues"
        label={label}
        value={photos}
        onChange={onChange}
        onUploadingChange={onUploadingChange}
      />
      <p className="mt-1.5 text-[13px] text-gray-400 dark:text-white/40">
        Optional — up to 5 photos. The first is your main photo. You can add or
        change these later from your dashboard.
      </p>
    </div>
  );
}

function SelectInput({
  value,
  placeholder,
  options,
  onChange,
  label,
}: {
  value: string;
  placeholder: string;
  options: string[];
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:focus:border-[#ff6a6a]"
      >
        <option value="">
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

/** Auto-dismiss a transient toast/message a few seconds after it's set. */
function useAutoClear(
  value: string | null,
  setter: (v: null) => void,
  ms = 4000
) {
  useEffect(() => {
    if (!value) return;
    const t = setTimeout(() => setter(null), ms);
    return () => clearTimeout(t);
  }, [value, setter, ms]);
}

export function VendorSection({
  visible,
  sectionRef,
  account,
  config,
  onContinueHome,
  onOpenAccount,
  onRefreshSession,
}: {
  visible: boolean;
  sectionRef: RefObject<HTMLElement | null>;
  account: ConsumerAccount | null;
  config: RuntimeConfig;
  onContinueHome: () => void;
  onOpenAccount: () => void;
  onRefreshSession?: () => void;
}) {
  const [initialDraft] = useState(() => readVendorDraft());
  const [step, setStep] = useState<VendorStep>("loading");
  const [searchInput, setSearchInput] = useState(
    () => initialDraft.searchText ?? ""
  );
  const [suggestions, setSuggestions] = useState<GenieVenue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [candidate, setCandidate] = useState<GenieVenue | null>(null);
  const [contact, setContact] = useState<VendorContactState>(() =>
    createContactState(account)
  );
  const [contactFieldErrors, setContactFieldErrors] = useState<Record<string, string>>({});
  const [entryMode, setEntryMode] = useState<"match" | "manual">(
    initialDraft.isManualEntry ? "manual" : "match"
  );
  const [selectedPlan, setSelectedPlan] = useState<
    "basic" | "pro" | "boost" | null
  >(() =>
    initialDraft.selectedPlanId === "basic" ||
    initialDraft.selectedPlanId === "pro" ||
    initialDraft.selectedPlanId === "boost"
      ? initialDraft.selectedPlanId
      : null
  );
  const [locationEnabled, setLocationEnabled] = useState<boolean | null>(
    typeof initialDraft.locationEnabled === "boolean"
      ? initialDraft.locationEnabled
      : null
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [vendorId, setVendorId] = useState<number | null>(
    () => initialDraft.vendorId ?? readConsumerAccount()?.vendorId ?? null
  );
  const [onboardingId, setOnboardingId] = useState<number | null>(
    () => initialDraft.onboardingId ?? null
  );

  const [manualInfo, setManualInfo] = useState<ManualBusinessInfo>({
    businessName: initialDraft.searchText ?? "",
    category: "",
    cuisine: "",
    phone: "",
    website: "",
    reservationUrl: "",
    instagram: "",
  });
  const [manualLocation, setManualLocation] = useState<ManualLocationInfo>({
    address: "",
    city: "Houston",
    state: "TX",
    zip: "",
    neighborhood: "",
  });
  const [manualProfile, setManualProfile] = useState<ManualProfileInfo>({
    shortDescription: "",
    priceBand: "",
    music: "",
    hookah: "",
    happyHour: "",
  });

  /**
   * Venue photos picked during onboarding. They upload to Cloudinary immediately,
   * but the venue does not exist until createVendorBusiness() runs on the plan
   * step — so the URLs are held here and attached in completeRegistration().
   */
  const [onboardingPhotos, setOnboardingPhotos] = useState<string[]>([]);
  const [photosUploading, setPhotosUploading] = useState(false);
  const [manualContact, setManualContact] = useState<ManualContactInfo>({
    firstName: account?.firstName ?? "",
    lastName: account?.lastName ?? "",
    email: account?.email ?? "",
    phone: account?.phone ?? "",
    roleTitle: "",
  });
  const [manualContactFieldErrors, setManualContactFieldErrors] = useState<Record<string, string>>({});

  const [dashboardData, setDashboardData] =
    useState<FullDashboardData | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);

  /* ---- Venue's own events + posts (acting_as: "venue") ---- */
  const [vendorEvents, setVendorEvents] = useState<ProducerEvent[]>([]);
  const [vendorEventsLoading, setVendorEventsLoading] = useState(false);
  const [vendorPosts, setVendorPosts] = useState<ProducerPost[]>([]);
  const [vendorPostsLoading, setVendorPostsLoading] = useState(false);
  const [contentTab, setContentTab] = useState<"events" | "posts">("events");
  const [contentMessage, setContentMessage] = useState<string | null>(null);
  const [eventActionBusyId, setEventActionBusyId] = useState<number | null>(null);

  /* create/edit-event form state */
  const [evTitle, setEvTitle] = useState("");
  const [evCategory, setEvCategory] = useState("");
  const [evDescription, setEvDescription] = useState("");
  const [evDate, setEvDate] = useState("");
  const [evStartTime, setEvStartTime] = useState("");
  const [evEndTime, setEvEndTime] = useState("");
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

  /* create/edit-post form state */
  const [postText, setPostText] = useState("");
  const [postImageUrls, setPostImageUrls] = useState<string[]>([]);
  const [postShowImageInput, setPostShowImageInput] = useState(false);
  const [postUploading, setPostUploading] = useState(false);
  const [postVideos, setPostVideos] = useState<VideoSlotValue[]>([]);
  const [postVideoUploading, setPostVideoUploading] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const editingPostId = useRef<number | null>(null);
  const [profileForm, setProfileForm] = useState({
    description: "",
    phone: "",
    website_url: "",
    reservation_url: "",
    hours: "",
  });
  /** Venue gallery, ordered; index 0 is the primary. Saved separately from the form. */
  const [venuePhotos, setVenuePhotos] = useState<string[]>([]);
  const [venuePhotosUploading, setVenuePhotosUploading] = useState(false);
  /**
   * False when the gallery failed to load. Saving is a whole-set replace, so
   * writing an empty list we never successfully read would delete the vendor's
   * existing photos.
   */
  const [venuePhotosLoaded, setVenuePhotosLoaded] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // Analytics screen
  const [analyticsPeriod, setAnalyticsPeriod] = useState<"7_days" | "30_days" | "all_time">("30_days");
  const [analyticsTotals, setAnalyticsTotals] = useState<VendorAnalyticsTotals | null>(null);
  const [analyticsDaily, setAnalyticsDaily] = useState<VendorAnalyticsDailyRecord[]>([]);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  // Dashboard performance widget (Pro only) — real 7-day data behind the chart/labels
  const [dashboardPerfTotals, setDashboardPerfTotals] = useState<VendorAnalyticsTotals | null>(null);
  const [dashboardPerfDaily, setDashboardPerfDaily] = useState<VendorAnalyticsDailyRecord[]>([]);
  const [isDashboardPerfLoading, setIsDashboardPerfLoading] = useState(false);

  // Offers screen
  const [offerMessage, setOfferMessage] = useState<string | null>(null);

  // Create-offer form
  const [offerForm, setOfferForm] = useState({
    title: "",
    description: "",
    offer_type: "happy_hour" as VendorOfferType,
    discount_value: "",
    redeem_instructions: "",
    link_url: "",
    redemption_limit: "",
    vibee_only: false,
  });
  const [offerFieldErrors, setOfferFieldErrors] = useState<Record<string, string>>({});
  const [isSavingOffer, setIsSavingOffer] = useState(false);

  // Influencer offer review queue (venue owner)
  const [influencerOffers, setInfluencerOffers] = useState<InfluencerOffer[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [vendorOfferFilter, setVendorOfferFilter] = useState<
    "active" | "pending" | "rejected" | "cancelled"
  >("pending");
  const [rejectingOfferId, setRejectingOfferId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewingOfferId, setReviewingOfferId] = useState<number | null>(null);

  // Boost screen
  const [selectedBoostTier, setSelectedBoostTier] = useState<string | null>(null);
  const [isBoostLoading, setIsBoostLoading] = useState(false);

  // Open/closed switch
  const [isOpenToggleSaving, setIsOpenToggleSaving] = useState(false);

  // Influencer codes screen
  const [influencerCodes, setInfluencerCodes] = useState<VendorInfluencerCode[]>([]);
  const [influencerLoading, setInfluencerLoading] = useState(false);
  const [selectedInfluencerCode, setSelectedInfluencerCode] = useState<string | null>(null);

  // Settings screen
  const [settingsForm, setSettingsForm] = useState({ smsPhone: "", emailNotif: true, pushNotif: true, smsNotif: false });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Auto-dismiss transient toast messages after a few seconds.
  useAutoClear(offerMessage, setOfferMessage);
  useAutoClear(statusMessage, setStatusMessage);
  useAutoClear(profileMessage, setProfileMessage);
  useAutoClear(settingsMessage, setSettingsMessage);

  const progressStep: Record<VendorStep, number> = {
    loading: 0,
    claim: 1,
    finding: 1,
    "not-found": 1,
    match: 1,
    contact: 2,
    photos: 3,
    "manual-info": 1,
    "manual-location": 2,
    "manual-profile": 3,
    "manual-contact": 3,
    location: 3,
    plan: 3,
    success: 4,
    dashboard: 4,
    profile: 4,
    analytics: 4,
    offers: 4,
    "create-offer": 4,
    boost: 4,
    "influencer-codes": 4,
    settings: 4,
    "my-content": 4,
    "create-event": 4,
    "create-post": 4,
  };

  // Gate check — runs once when the section becomes visible.
  // Mirrors the producer pattern: always ask the server, never rely solely on cache.
  useEffect(() => {
    if (!visible) return;
    if (step !== "loading") return;
    let cancelled = false;

    fetchMyVendorProfile()
      .then(({ vendor }) => {
        if (cancelled) return;
        if (vendor?.id) {
          setVendorId(vendor.id);
          persistVendorIdToAccount(vendor.id);
          setStep("dashboard");
        } else {
          // Fall back to draft for in-progress onboarding
          const draft = readVendorDraft();
          if (draft.vendorId && draft.currentStep) {
            const saved = draft.currentStep as VendorStep;
            if (["contact", "photos", "plan", "success", "dashboard", "manual-info", "manual-location", "manual-profile", "manual-contact"].includes(saved)) {
              setVendorId(draft.vendorId);
              setStep(saved);
              return;
            }
          }
          setStep("claim");
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Not logged in or network error — check draft then fall to claim
        const draft = readVendorDraft();
        if (draft.vendorId && draft.currentStep) {
          const saved = draft.currentStep as VendorStep;
          if (["contact", "photos", "plan", "success", "dashboard", "manual-info", "manual-location", "manual-profile", "manual-contact"].includes(saved)) {
            setVendorId(draft.vendorId);
            setStep(saved);
            return;
          }
        }
        setStep("claim");
      });

    return () => { cancelled = true; };
  }, [visible, step]);

  useEffect(() => {
    if (!account) {
      setContact(createContactState(null));
      return;
    }
    setContact((c) => ({
      firstName: c.firstName || account.firstName,
      lastName: c.lastName || account.lastName,
      email: c.email || account.email,
      phone: c.phone || account.phone || "",
    }));
    setManualContact((c) => ({
      ...c,
      firstName: c.firstName || account.firstName,
      lastName: c.lastName || account.lastName,
      email: c.email || account.email,
      phone: c.phone || account.phone || "",
    }));
  }, [account]);

  useEffect(() => {
    if (!visible || !account || step !== "claim") return;
    trackEvent(analyticsEvents.vendorClaimStarted);
  }, [account, step, visible]);

  useEffect(() => {
    if (!visible || step !== "profile" || !account) return;
    const vid = vendorId ?? account.vendorId;
    if (!vid) return;
    let cancelled = false;
    setIsProfileLoading(true);
    const str = (val: unknown) =>
      typeof val === "string" ? val : val == null ? "" : String(val);
    Promise.all([
      fetchVendorDashboard(vid).catch(() => null),
      fetchVendorVenue().catch(() => null),
      fetchVenueImages().then(
        (photos) => ({ photos, ok: true }),
        () => ({ photos: [] as string[], ok: false })
      ),
    ])
      .then(([d, venueResp, photoResult]) => {
        if (cancelled) return;
        setVenuePhotos(photoResult.photos);
        setVenuePhotosLoaded(photoResult.ok);
        const venue = venueResp?.venue ?? null;
        const vendor = venueResp?.vendor ?? null;
        setProfileForm({
          description: str(venue?.vibe_notes ?? d?.description ?? d?.vibe_notes),
          phone: str(venue?.phone ?? d?.phone),
          website_url: str(
            venue?.website_url ?? d?.website_url ?? d?.website
          ),
          reservation_url: str(
            venue?.reservation_url ??
              vendor?.reservation_url ??
              d?.reservation_url
          ),
          hours: str(venue?.hours_text ?? d?.hours_text),
        });
      })
      .catch(() => {
        // Leave form empty on error
      })
      .finally(() => {
        if (!cancelled) setIsProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, step, account, vendorId]);

  // Influencer codes loader
  useEffect(() => {
    if (!visible || step !== "influencer-codes") return;
    const vid = vendorId ?? account?.vendorId;
    if (!vid) return;
    let cancelled = false;
    setInfluencerLoading(true);
    fetchVendorInfluencerCodes(vid)
      .then((res) => {
        if (!cancelled) setInfluencerCodes(res?.codes ?? []);
      })
      .catch(() => {
        // Gracefully fall back to empty — endpoint may not exist yet
        if (!cancelled) setInfluencerCodes([]);
      })
      .finally(() => { if (!cancelled) setInfluencerLoading(false); });
    return () => { cancelled = true; };
  }, [visible, step, vendorId, account]);

  // Analytics loader
  useEffect(() => {
    if (!visible || step !== "analytics") return;
    const vid = vendorId ?? account?.vendorId;
    if (!vid) return;
    let cancelled = false;
    setIsAnalyticsLoading(true);
    fetchVendorAnalytics(vid, analyticsPeriod)
      .then((res) => {
        if (cancelled) return;
        setAnalyticsTotals(res?.totals ?? null);
        setAnalyticsDaily(res?.daily_records ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setAnalyticsTotals(null);
          setAnalyticsDaily([]);
        }
      })
      .finally(() => { if (!cancelled) setIsAnalyticsLoading(false); });
    return () => { cancelled = true; };
  }, [visible, step, vendorId, account, analyticsPeriod]);

  // Dashboard performance widget loader — real 7-day data behind the chart/labels,
  // Pro only (the widget itself is Pro-gated, no point fetching for Free vendors).
  useEffect(() => {
    if (!visible || step !== "dashboard" || !dashboardData?.is_pro) return;
    const vid = vendorId ?? dashboardData?.vendor_id;
    if (!vid) return;
    let cancelled = false;
    setIsDashboardPerfLoading(true);
    fetchVendorAnalytics(vid, "7_days")
      .then((res) => {
        if (cancelled) return;
        setDashboardPerfTotals(res?.totals ?? null);
        setDashboardPerfDaily(res?.daily_records ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setDashboardPerfTotals(null);
          setDashboardPerfDaily([]);
        }
      })
      .finally(() => { if (!cancelled) setIsDashboardPerfLoading(false); });
    return () => { cancelled = true; };
  }, [visible, step, vendorId, dashboardData?.is_pro, dashboardData?.vendor_id]);

  // Settings — pre-load notification preferences
  useEffect(() => {
    if (!visible || step !== "settings" || settingsLoaded) return;
    const extId = readExternalUserId();
    if (!extId) return;
    let cancelled = false;
    fetchVendorNotifPrefs(extId)
      .then((prefs) => {
        if (cancelled) return;
        setSettingsForm({
          smsPhone: prefs.sms_phone ?? "",
          emailNotif: prefs.email_notifications ?? true,
          pushNotif: prefs.push_notifications ?? true,
          smsNotif: prefs.sms_notifications ?? false,
        });
        setSettingsLoaded(true);
      })
      .catch(() => { /* keep defaults */ });
    return () => { cancelled = true; };
  }, [visible, step, account, settingsLoaded]);

  const loadDashboard = useCallback(async () => {
    const vid = vendorId ?? account?.vendorId;
    if (!vid) return;

    setIsDashboardLoading(true);
    try {
      const [dashboard, venueResp] = await Promise.all([
        fetchVendorDashboard(vid),
        fetchVendorVenue().catch(() => null),
      ]);

      const merged: FullDashboardData = { ...dashboard };
      const vendor = venueResp?.vendor ?? null;
      const venue = venueResp?.venue ?? null;

      // Display name: prefer the venue's own name, then the vendor's business
      // name, then fall back to the dashboard value.
      const displayName =
        (venue?.venue_name && venue.venue_name.trim()) ||
        (vendor?.business_name && vendor.business_name.trim()) ||
        "";
      if (displayName) merged.business_name = displayName;

      if (vendor) {
        if (vendor.is_claimed != null) merged.is_claimed = vendor.is_claimed;
        if (vendor.is_live != null) merged.is_live = vendor.is_live;
        // is_pro is deliberately not re-derived here: vendor_dashboard_v1 already
        // computes it from plan_selected, and duplicating that rule client-side is
        // what previously broke it (it compared against "pro", a plan-picker id
        // that Xano never stores — the real value is "founding_partner").
        if (vendor.monthly_boost_active != null) {
          merged.boost_active = vendor.monthly_boost_active;
        }
      }

      if (venue) {
        if (venue.google_rating != null && venue.google_rating > 0) {
          merged.rating = venue.google_rating;
        }
        if (venue.address) merged.address = venue.address;
        if (venue.venue_type) merged.category = venue.venue_type;
        const cuisineLabel = formatTagRecord(venue.cuisine_tags);
        if (cuisineLabel) merged.cuisine = cuisineLabel;
        if (venue.website_url) {
          merged.website = venue.website_url;
          merged.website_url = venue.website_url;
        }
        // Prefer venue's reservation URL; fall back to vendor's.
        const reservationUrl =
          venue.reservation_url || vendor?.reservation_url || "";
        if (reservationUrl) merged.reservation_url = reservationUrl;
        if (venue.instagram_handle) merged.instagram = venue.instagram_handle;
        if (venue.vibe_notes) {
          merged.description = venue.vibe_notes;
          merged.vibe_notes = venue.vibe_notes;
        }
        if (venue.phone) merged.phone = venue.phone;
        if (venue.is_open_now != null) merged.is_open_now = venue.is_open_now;
        if (venue.hours_text) merged.hours_text = venue.hours_text;
        if (venue.image_primary_url) merged.image_primary_url = venue.image_primary_url;
      } else if (vendor?.reservation_url) {
        merged.reservation_url = vendor.reservation_url;
      }

      setDashboardData(merged);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not load dashboard data."
      );
    } finally {
      setIsDashboardLoading(false);
    }
  }, [vendorId, account]);

  // Optimistic open/closed switch — revert on failure so the control never
  // shows a state the venue record doesn't actually have.
  const toggleOpenNow = useCallback(async (next: boolean) => {
    setIsOpenToggleSaving(true);
    setDashboardData((prev) => (prev ? { ...prev, is_open_now: next } : prev));
    try {
      await updateVendorVenue({ is_open_now: next });
    } catch (error) {
      setDashboardData((prev) =>
        prev ? { ...prev, is_open_now: !next } : prev
      );
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not update your open/closed status."
      );
    } finally {
      setIsOpenToggleSaving(false);
    }
  }, []);

  /* ---- Venue's own events + posts (acting_as: "venue") ---- */
  const refreshVendorEvents = useCallback(async () => {
    setVendorEventsLoading(true);
    try {
      const data = await fetchMyEvents(1, 50, "venue");
      setVendorEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      /* non-fatal — keep existing list */
    } finally {
      setVendorEventsLoading(false);
    }
  }, []);

  const refreshVendorPosts = useCallback(async () => {
    setVendorPostsLoading(true);
    try {
      const data = await fetchMyPosts(1, 50, "venue");
      setVendorPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch {
      /* non-fatal — keep existing list */
    } finally {
      setVendorPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || step !== "dashboard") return;
    void loadDashboard();
    // Counts for the "Events & Posts" dashboard card — fetched here so it's
    // accurate on first load, not just after visiting "My Events & Posts".
    void refreshVendorEvents();
    void refreshVendorPosts();
  }, [visible, step, loadDashboard, refreshVendorEvents, refreshVendorPosts]);

  // ── Influencer offer review queue (venue owner) ────────────────────────────

  const [pendingError, setPendingError] = useState<string | null>(null);

  const loadInfluencerOffers = useCallback(async () => {
    setIsLoadingPending(true);
    setPendingError(null);
    try {
      const res = await fetchVendorInfluencerOffers();
      setInfluencerOffers(res.offers ?? []);
    } catch (err) {
      setInfluencerOffers([]);
      setPendingError(
        err instanceof Error ? err.message : "Could not load offers."
      );
    } finally {
      setIsLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || step !== "offers") return;
    void loadInfluencerOffers();
  }, [visible, step, loadInfluencerOffers]);

  const handleReviewOffer = useCallback(
    async (
      offerId: number,
      decision: "approve" | "reject" | "cancel",
      reason?: string
    ) => {
      setReviewingOfferId(offerId);
      setOfferMessage(null);
      try {
        await reviewInfluencerOffer({
          offer_id: offerId,
          decision,
          rejection_reason: reason,
        });
        // Move the reviewed offer to its new status in place so it appears
        // under the Active / Rejected / Cancelled tab instead of vanishing.
        const newStatus =
          decision === "approve"
            ? "active"
            : decision === "cancel"
              ? "cancelled"
              : "rejected";
        setInfluencerOffers((prev) =>
          prev.map((o) =>
            o.id === offerId
              ? { ...o, status: newStatus, rejection_reason: reason }
              : o
          )
        );
        setRejectingOfferId(null);
        setRejectReason("");
        setOfferMessage(
          decision === "approve"
            ? "Offer approved."
            : decision === "cancel"
              ? "Offer cancelled."
              : "Offer rejected."
        );
      } catch (err) {
        setOfferMessage(
          err instanceof Error ? err.message : "Could not review offer."
        );
      } finally {
        setReviewingOfferId(null);
      }
    },
    []
  );

  /** Persist vendor_id into ConsumerAccount localStorage so dashboard survives refresh */
  const persistVendorIdToAccount = (vid: number) => {
    const current = readConsumerAccount();
    if (current) {
      writeConsumerAccount({ ...current, vendorId: vid });
    }
    // Also keep it in the draft as a fallback for non-authenticated users
    writeVendorDraft({ vendorId: vid, currentStep: "dashboard" });
  };

  useEffect(() => {
    if (
      !visible ||
      step !== "claim" ||
      searchInput.trim().length < 2
    ) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await searchVendorBusinesses(searchInput.trim());
          if (cancelled) return;
          setSuggestions(results);
          setIsSearching(false);
          if (results.length) {
            trackEvent(analyticsEvents.vendorBusinessSuggestionShown, {
              searchText: searchInput,
              suggestionCount: results.length,
            });
          }
        } catch {
          if (cancelled) return;
          setSuggestions([]);
          setIsSearching(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [searchInput, step, visible]);

  if (!visible) return null;

  if (!account) {
    return (
      <section
        ref={sectionRef}
        className="relative min-h-full overflow-hidden px-5 pb-32 pt-14"
      >
        <div className="mx-auto flex w-full max-w-md flex-col items-center">
          <div className="relative mb-6 h-28 w-28 overflow-hidden rounded-full border-2 border-red-400/40">
            <Image
              src="/genie-profile-pic.png"
              alt="Genie"
              fill
              className="object-cover"
            />
          </div>
          <h2 className="text-center text-[1.65rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Claim your business on Genie
          </h2>
          <p className="mt-3 text-center text-[15px] leading-relaxed text-gray-500 dark:text-white/60">
            Get discovered by people looking for spots like yours.
          </p>
          <div className="mt-8 w-full space-y-3">
            <ActionButton onClick={onOpenAccount} className="w-full">
              Create Account to Get Started
            </ActionButton>
            <ActionButton
              onClick={onContinueHome}
              variant="secondary"
              className="w-full"
            >
              Back to Home
            </ActionButton>
          </div>
        </div>
      </section>
    );
  }

  const goBack = () => {
    setStatusMessage(null);
    setProfileMessage(null);
    setOfferMessage(null);
    switch (step) {
      case "claim":
      case "dashboard":
        onContinueHome();
        break;
      case "create-offer":
        setStep("offers");
        break;
      case "create-event":
      case "create-post":
        setStep("my-content");
        break;
      case "profile":
      case "analytics":
      case "offers":
      case "boost":
      case "influencer-codes":
      case "settings":
      case "my-content":
        setStep("dashboard");
        break;
      case "finding":
      case "not-found":
      case "match":
        setStep("claim");
        break;
      case "contact":
        setStep(candidate ? "match" : "claim");
        break;
      case "manual-info":
        setStep("not-found");
        break;
      case "manual-location":
        setStep("manual-info");
        break;
      case "manual-profile":
        setStep("manual-location");
        break;
      case "manual-contact":
        setStep("manual-profile");
        break;
      case "plan":
        setStep("contact");
        break;
      case "location":
        setStep(entryMode === "manual" ? "manual-contact" : "contact");
        break;
      case "success":
        onContinueHome();
        break;
      default:
        onContinueHome();
    }
  };

  const runSearch = async (searchText: string) => {
    const trimmed = searchText.trim();
    if (!trimmed) return;

    setStep("finding");
    setStatusMessage(null);
    setIsSubmitting(true);
    writeVendorDraft({ ...readVendorDraft(), searchText: trimmed });
    trackEvent(analyticsEvents.vendorBusinessSearchStarted, {
      searchText: trimmed,
    });

    try {
      const results = await searchVendorBusinesses(trimmed);
      const match =
        results.find(
          (v) => v.venue_name.toLowerCase() === trimmed.toLowerCase()
        ) ??
        results[0] ??
        null;

      if (match) {
        setCandidate(match);
        setEntryMode("match");
        setStep("match");
        writeVendorDraft({
          ...readVendorDraft(),
          searchText: trimmed,
          matchedBusinessId: getVenueId(match),
        });
        trackEvent(analyticsEvents.vendorBusinessSearchCompleted, {
          matchedBusinessId: getVenueId(match),
        });
      } else {
        setCandidate(null);
        setStep("not-found");
        trackEvent(analyticsEvents.vendorBusinessSearchNoMatch, {
          searchText: trimmed,
        });
      }
    } catch (error) {
      setStep("claim");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not search businesses right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmMatch = async () => {
    if (!candidate) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const result = await vendorOnboardingSearch({
        business_name: candidate.venue_name,
      });
      setVendorId(result.vendor_id);
      setOnboardingId(result.onboarding_id);
      writeVendorDraft({
        ...readVendorDraft(),
        vendorId: result.vendor_id,
        onboardingId: result.onboarding_id,
        currentStep: "contact",
      });
      setStep("contact");
      trackEvent(analyticsEvents.vendorBusinessConfirmed, {
        matchedBusinessId: getVenueId(candidate),
      });
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not start onboarding."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContactSubmit = async () => {
    if (!vendorId || !onboardingId) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await vendorOnboardingContact({
        vendor_id: vendorId,
        onboarding_id: onboardingId,
        first_name: contact.firstName.trim(),
        last_name: contact.lastName.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim() || undefined,
      });
      await vendorOnboardingConfirm({
        vendor_id: vendorId,
        onboarding_id: onboardingId,
        confirmed: true,
      });
      writeVendorDraft({
        ...readVendorDraft(),
        vendorId,
        onboardingId,
        currentStep: "photos",
      });
      setStep("photos");
      trackEvent(analyticsEvents.vendorContactInfoCompleted);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not save contact info."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeRegistration = async () => {
    if (!selectedPlan) {
      setStatusMessage("Pick a plan before continuing.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      let finalVendorId = vendorId;

      if (entryMode === "manual") {
        const createResult = await createVendorBusiness({
          business_name: manualInfo.businessName.trim(),
          full_name: `${manualContact.firstName} ${manualContact.lastName}`.trim(),
          email: manualContact.email.trim(),
          phone: manualContact.phone.trim() || undefined,
          address: manualLocation.address.trim(),
          city: manualLocation.city.trim(),
          state: manualLocation.state.trim(),
          zip: manualLocation.zip.trim(),
          neighborhood: manualLocation.neighborhood.trim(),
          category: manualInfo.category,
          cuisine: manualInfo.cuisine,
          website: manualInfo.website,
          reservation_url: manualInfo.reservationUrl,
          instagram: manualInfo.instagram,
          short_description: manualProfile.shortDescription,
          price_band: manualProfile.priceBand,
          music: manualProfile.music,
          hookah: manualProfile.hookah,
          happy_hour: manualProfile.happyHour,
          main_photo_url: onboardingPhotos[0] ?? "",
          role_title: manualContact.roleTitle,
        });
        setVendorId(createResult.vendor_id);
        if (createResult.onboarding_id) {
          setOnboardingId(createResult.onboarding_id);
        }
        finalVendorId = createResult.vendor_id;
        writeVendorDraft({
          ...readVendorDraft(),
          vendorId: createResult.vendor_id,
          onboardingId: createResult.onboarding_id,
          currentStep: "plan",
        });

        trackEvent(analyticsEvents.vendorManualAddCompleted, {
          businessName: manualInfo.businessName.trim(),
        });
      }

      // Attach the photos now that the vendor and its venue exist. Do this before
      // any Stripe redirect, or the URLs are lost when we leave the page.
      // A failure here is not fatal — the vendor is created, and they can add
      // photos from the dashboard — but it must not pass silently.
      if (onboardingPhotos.length > 0) {
        try {
          await saveVenueImages(onboardingPhotos);
        } catch (error) {
          console.error("Could not attach venue photos during onboarding", error);
          setStatusMessage(
            "Your business was created, but the photos didn't save. You can add them from your dashboard."
          );
        }
      }

      if (selectedPlan === "pro" && finalVendorId) {
        // Persist vendor ID before redirecting to Stripe
        persistVendorIdToAccount(finalVendorId);
        const { checkout_url } = await createSubscriptionCheckout({
          vendor_id: finalVendorId,
          plan_type: "founding_partner",
        });
        window.location.href = checkout_url;
        return;
      }

      if (finalVendorId) {
        persistVendorIdToAccount(finalVendorId);
      }
      // Keep vendorId in draft so dashboard loads on refresh
      writeVendorDraft({ vendorId: finalVendorId ?? undefined, currentStep: "dashboard" });
      setStep("success");
      trackEvent(analyticsEvents.vendorRegistrationCompleted, {
        planId: selectedPlan,
        mode: entryMode,
      });

      onRefreshSession?.();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not finish vendor registration right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnableLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationEnabled(false);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    navigator.geolocation.getCurrentPosition(
      () => {
        setIsSubmitting(false);
        setLocationEnabled(true);
        trackEvent(analyticsEvents.vendorLocationEnabled);
      },
      () => {
        setIsSubmitting(false);
        setLocationEnabled(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleSaveProfile = async () => {
    setIsProfileSaving(true);
    setProfileMessage(null);

    try {
      const payload: Parameters<typeof updateVendorVenue>[0] = {};
      if (profileForm.description.trim())
        payload.description = profileForm.description.trim();
      if (profileForm.phone.trim()) payload.phone = profileForm.phone.trim();
      if (profileForm.website_url.trim())
        payload.website_url = profileForm.website_url.trim();
      if (profileForm.reservation_url.trim())
        payload.reservation_url = profileForm.reservation_url.trim();
      if (profileForm.hours.trim())
        payload.hours_text = profileForm.hours.trim();

      // The gallery is its own endpoint, and it keeps image_primary_url in sync
      // with photo 0 — so this must not also send image_primary_url.
      await updateVendorVenue(payload);
      if (venuePhotosLoaded) {
        await saveVenueImages(venuePhotos);
      }
      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : "Could not update your profile."
      );
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleCreateOffer = async () => {
    const vid = vendorId ?? account?.vendorId;
    if (!vid) {
      setOfferMessage("Could not find your vendor account. Try reloading.");
      return;
    }

    const errors: Record<string, string> = {};
    if (!offerForm.title.trim()) errors.title = "An offer title is required.";
    else if (offerForm.title.trim().length > OFFER_TITLE_MAX) {
      errors.title = `Title must be ${OFFER_TITLE_MAX} characters or fewer.`;
    }
    if (!offerForm.description.trim()) errors.description = "An offer description is required.";
    else if (offerForm.description.trim().length > OFFER_DESCRIPTION_MAX) {
      errors.description = `Description must be ${OFFER_DESCRIPTION_MAX} characters or fewer.`;
    }

    const limit = Number(offerForm.redemption_limit);
    if (
      offerForm.redemption_limit.trim() &&
      (!Number.isFinite(limit) || limit <= 0)
    ) {
      errors.redemption_limit = "Redemption limit must be a positive number.";
    }

    if (offerForm.link_url.trim() && !isUrlValid(offerForm.link_url.trim())) {
      errors.link_url = "Enter a valid link starting with http:// or https://.";
    }

    if (Object.keys(errors).length > 0) {
      setOfferFieldErrors(errors);
      setOfferMessage(null);
      return;
    }

    setOfferFieldErrors({});
    setIsSavingOffer(true);
    setOfferMessage(null);

    try {
      const payload: Parameters<typeof createVendorOffer>[0] = {
        vendor_id: vid,
        title: offerForm.title.trim(),
        description: offerForm.description.trim(),
        offer_type: offerForm.offer_type,
        vibee_only: offerForm.vibee_only,
      };
      if (offerForm.discount_value.trim())
        payload.discount_value = offerForm.discount_value.trim();
      if (offerForm.redeem_instructions.trim())
        payload.redeem_instructions = offerForm.redeem_instructions.trim();
      if (offerForm.link_url.trim()) payload.link_url = offerForm.link_url.trim();
      // redeem_offer gates on `redemption_limit == 0 || redemption_count < limit`,
      // so 0 means unlimited. A null limit satisfies neither branch and would make
      // the offer permanently unredeemable — send an explicit 0 when left blank.
      payload.redemption_limit = offerForm.redemption_limit.trim() ? limit : 0;

      await createVendorOffer(payload);

      setOfferForm({
        title: "",
        description: "",
        offer_type: "happy_hour",
        discount_value: "",
        redeem_instructions: "",
        link_url: "",
        redemption_limit: "",
        vibee_only: false,
      });
      await loadDashboard();
      setStep("offers");
      setOfferMessage("Offer created.");
    } catch (error) {
      // Xano's create gates share one error code but return distinct, already
      // user-readable messages ("Vendor must be active to create offers.",
      // "Vendor must be a Pro Genie Vendor to create offers."), so pass them
      // through rather than flattening them into one vague line.
      setOfferMessage(
        error instanceof Error ? error.message : "Could not create offer."
      );
    } finally {
      setIsSavingOffer(false);
    }
  };

  function openMyContent() {
    setContentMessage(null);
    setStep("my-content");
    void refreshVendorEvents();
    void refreshVendorPosts();
  }

  function openCreateEvent() {
    editingEventId.current = null;
    setEvTitle(""); setEvCategory(""); setEvDescription(""); setEvDate("");
    setEvStartTime(""); setEvEndTime("");
    setEvTicketUrl("");
    setEvImageUrls([]); setEvUploading(false);
    setEvVideos([]); setEvVideoUploading(false);
    setEvError(null); setEvFieldErrors({});
    setStep("create-event");
  }

  function openEditEvent(ev: ProducerEvent) {
    editingEventId.current = ev.id;
    setEvTitle(ev.title ?? "");
    setEvCategory(ev.category ?? "");
    setEvDescription(ev.description ?? "");
    setEvDate(ev.event_date ?? "");
    setEvStartTime(ev.start_time ?? "");
    setEvEndTime(ev.end_time ?? "");
    setEvTicketUrl(ev.ticket_url ?? "");
    setEvImageUrls(galleryFor(ev.cover_image_url, ev.image_urls));
    setEvUploading(false);
    setEvVideos([]);
    setEvVideoUploading(false);
    setEvError(null);
    setEvFieldErrors({});
    setStep("create-event");
  }

  function openCreatePost() {
    editingPostId.current = null;
    setPostText(""); setPostImageUrls([]); setPostShowImageInput(false);
    setPostUploading(false);
    setPostVideos([]); setPostVideoUploading(false);
    setPostError(null);
    setStep("create-post");
  }

  function openEditPost(p: ProducerPost) {
    editingPostId.current = p.id;
    setPostText(p.post_text ?? "");
    setPostImageUrls(galleryFor(p.image_url, p.image_urls));
    setPostShowImageInput((p.image_urls?.length ?? 0) > 0);
    setPostUploading(false);
    setPostVideos([]);
    setPostVideoUploading(false);
    setPostError(null);
    setStep("create-post");
  }

  async function handleVendorEventSubmit(e: FormEvent) {
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
      await createProducerEvent({
        title: evTitle.trim(),
        category: evCategory,
        description: evDescription.trim() || undefined,
        event_date: evDate,
        start_time: evStartTime,
        end_time: evEndTime || undefined,
        ticket_url: evTicketUrl.trim() || undefined,
        cover_image_url: evImageUrls[0] || undefined,
        image_urls: evImageUrls,
        video_urls: videoUrls.length > 0 ? videoUrls : undefined,
        event_id: editingEventId.current ?? undefined,
        acting_as: "venue",
      });
      setContentMessage(editingEventId.current ? "Event updated." : "Event created.");
      setStep("my-content");
      setContentTab("events");
      void refreshVendorEvents();
    } catch (err) {
      setEvError(err instanceof Error ? err.message : "Could not save event. Please try again.");
    } finally {
      setEvBusy(false);
    }
  }

  async function handleVendorPostSubmit(e: FormEvent) {
    e.preventDefault();
    if (!postText.trim()) { setPostError("Post text is required."); return; }
    if (postText.trim().length > POST_TEXT_MAX) { setPostError(`Post text must be ${POST_TEXT_MAX} characters or fewer.`); return; }
    if (postImageUrls.length + postVideos.length > 5) { setPostError("A post can have at most 5 photos and videos combined."); return; }
    if (postUploading || postVideoUploading) { setPostError("Please wait for your photos and videos to finish uploading."); return; }
    setPostBusy(true);
    setPostError(null);
    try {
      const postVideoUrls: VideoItem[] = postVideos.map((v) => ({ url: v.url, thumbnail_url: v.thumbnailUrl }));
      if (editingPostId.current) {
        await updateProducerPost({
          post_id: editingPostId.current,
          post_text: postText.trim(),
          image_url: postImageUrls[0] || undefined,
          image_urls: postImageUrls,
          video_urls: postVideoUrls.length > 0 ? postVideoUrls : undefined,
          acting_as: "venue",
        });
      } else {
        await createProducerPost({
          post_text: postText.trim(),
          image_url: postImageUrls[0] || undefined,
          image_urls: postImageUrls,
          video_urls: postVideoUrls.length > 0 ? postVideoUrls : undefined,
          acting_as: "venue",
        });
      }
      setContentMessage(editingPostId.current ? "Post updated." : "Post published.");
      setStep("my-content");
      setContentTab("posts");
      void refreshVendorPosts();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Could not save post. Please try again.");
    } finally {
      setPostBusy(false);
    }
  }

  async function handleVendorPostDelete(postId: number) {
    setContentMessage(null);
    try {
      await deleteProducerPost(postId, "venue");
      setVendorPosts((prev) => prev.filter((p) => p.id !== postId));
      setContentMessage("Post deleted.");
    } catch (err) {
      setContentMessage(err instanceof Error ? err.message : "Could not delete post.");
    }
  }

  async function handleVendorEventCancel(eventId: number) {
    setContentMessage(null);
    setEventActionBusyId(eventId);
    try {
      await cancelProducerEvent(eventId, "venue");
      setVendorEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, status: "cancelled" } : e))
      );
      setContentMessage("Event cancelled.");
    } catch (err) {
      setContentMessage(err instanceof Error ? err.message : "Could not cancel event.");
    } finally {
      setEventActionBusyId(null);
    }
  }

  const stepTitle: Record<VendorStep, string> = {
    loading: "",
    claim:
      searchInput.trim().length >= 2
        ? "Select your business"
        : "Claim your business on Genie",
    finding: "Select your business",
    "not-found": "Add your business",
    match: "Select your business",
    contact: "Your contact info",
    photos: "Add your photos",
    "manual-info": "Business Info",
    "manual-location": "Location - Required",
    "manual-profile": "Genie Profile",
    "manual-contact": "Contact Info",
    location: "Share your location",
    plan: "Choose your plan",
    success: "",
    dashboard: "",
    profile: "Edit Profile",
    analytics: "Analytics",
    offers: "Manage Offers",
    "create-offer": "Create Offer",
    boost: "Boost Your Listing",
    "influencer-codes": "Influencer Codes",
    settings: "Settings",
    "my-content": "Events & Posts",
    "create-event": editingEventId.current ? "Edit Event" : "Create Event",
    "create-post": editingPostId.current ? "Edit Post" : "Create Post",
  };

  const isPro = Boolean(dashboardData?.is_pro);

  if (step === "loading") {
    return (
      <section ref={sectionRef} className="flex min-h-[40vh] flex-col items-center justify-center gap-4 pb-28">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-200 border-t-red-600 dark:border-white/10 dark:border-t-red-500" />
        <p className="text-sm text-gray-500 dark:text-white/50">Checking your profile…</p>
      </section>
    );
  }

  // Onboarding needs an account: photo upload and the final createVendorBusiness
  // call both require a bearer token. Ask up front rather than letting someone
  // fill in five screens of business details and fail at the last step.
  if (!account && step !== "dashboard") {
    return (
      <section ref={sectionRef} className="relative min-h-full px-5 pb-32 pt-6">
        <h2 className="mt-8 text-center text-[1.65rem] font-semibold leading-tight text-gray-900 dark:text-white">
          Sign in to list your business
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-center text-[15px] leading-relaxed text-gray-500 dark:text-white/60">
          You&apos;ll need an account so we can save your business, your photos, and
          your plan. It only takes a moment.
        </p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
          <ActionButton onClick={onOpenAccount} className="w-full">
            Sign in or create an account
          </ActionButton>
          <ActionButton onClick={onContinueHome} variant="secondary" className="w-full">
            Not now
          </ActionButton>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative min-h-full overflow-hidden px-5 pb-32 pt-6"
    >
      {/* Back arrow + progress bar */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="flex-none text-gray-600 dark:text-white/82"
          aria-label="Go back"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
          </svg>
        </button>
        {step !== "dashboard" &&
          step !== "profile" &&
          step !== "create-offer" && (
            <div className="flex-1">
              <ProgressBar step={progressStep[step]} />
            </div>
          )}
      </div>

      {stepTitle[step] ? (
        <h2 className="mb-1 text-center text-[1.65rem] font-semibold leading-tight text-gray-900 dark:text-white">
          {stepTitle[step]}
        </h2>
      ) : null}

      {step === "claim" && searchInput.trim().length < 2 && (
        <p className="mb-6 mt-2 text-center text-[15px] leading-relaxed text-gray-500 dark:text-white/60">
          Get discovered by people looking for spots like yours.
        </p>
      )}

      {/* ======== STEP: CLAIM ======== */}
      {step === "claim" && (
        <div className="mt-5 space-y-2">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 dark:border-[#b74c4c]/55 dark:bg-black/20">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 flex-none text-gray-400 dark:text-white/42"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                trackEvent(analyticsEvents.vendorBusinessSearchTyped, {
                  searchText: e.target.value,
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runSearch(searchInput);
                }
              }}
              placeholder="Search your business name"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white dark:placeholder:text-white/30"
            />
          </div>

          {suggestions.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-[#b74c4c]/55 dark:bg-black/20">
              {suggestions.map((venue, idx) => (
                <button
                  key={`sug-${venue.id}`}
                  type="button"
                  onClick={() => {
                    setSearchInput(venue.venue_name);
                    trackEvent(
                      analyticsEvents.vendorBusinessSuggestionSelected,
                      { businessId: getVenueId(venue), venueName: venue.venue_name }
                    );
                    void runSearch(venue.venue_name);
                  }}
                  className={`w-full px-4 py-3.5 text-left transition hover:bg-gray-50 dark:hover:bg-white/5 ${
                    idx < suggestions.length - 1
                      ? "border-b border-gray-100 dark:border-white/10"
                      : ""
                  }`}
                >
                  <p className="text-[15px] font-medium text-gray-900 dark:text-white">
                    {venue.venue_name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-gray-400 dark:text-white/42">
                    {venue.address || venue.area_neighborhood || "Houston"}
                  </p>
                </button>
              ))}
            </div>
          )}

          {isSearching && searchInput.trim().length >= 2 && (
            <p className="pt-1 text-center text-sm text-gray-400 dark:text-white/42">
              Searching. . .
            </p>
          )}

          {!isSearching &&
            suggestions.length === 0 &&
            searchInput.trim().length < 2 && (
              <p className="mt-2 text-[13px] text-gray-400 dark:text-white/42">
                We&apos;ll match your business so you don&apos;t have to start
                from scratch
              </p>
            )}

          {!isSearching &&
            suggestions.length === 0 &&
            searchInput.trim().length >= 2 && (
              <div className="space-y-2 pt-1">
                <p className="text-center text-[13px] text-gray-400 dark:text-white/42">
                  No results for &ldquo;{searchInput}&rdquo;
                </p>
                <ActionButton
                  onClick={() => {
                    setEntryMode("manual");
                    setManualInfo((c) => ({ ...c, businessName: searchInput }));
                    writeVendorDraft({
                      ...readVendorDraft(),
                      isManualEntry: true,
                      currentStep: "manual-info",
                    });
                    setStep("manual-info");
                    trackEvent(analyticsEvents.vendorManualAddStarted);
                  }}
                  className="w-full"
                >
                  Add my business manually
                </ActionButton>
              </div>
            )}
        </div>
      )}

      {/* ======== STEP: FINDING ======== */}
      {step === "finding" && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 dark:border-[#b74c4c]/55 dark:bg-black/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-gray-400 dark:text-white/42" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
            </svg>
            <span className="text-[15px] text-gray-900 dark:text-white">{searchInput}</span>
          </div>
          <p className="pt-1 text-center text-sm text-gray-400 dark:text-white/42">Searching. . .</p>
        </div>
      )}

      {/* ======== STEP: NOT-FOUND ======== */}
      {step === "not-found" && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 dark:border-[#b74c4c]/55 dark:bg-black/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-gray-400 dark:text-white/42" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
            </svg>
            <span className="text-[15px] text-gray-900 dark:text-white">{searchInput || "Your search"}</span>
          </div>
          <div className="text-[13px] leading-relaxed text-gray-500 dark:text-white/60">
            <p>Sorry we didn&apos;t find &ldquo;{searchInput}&rdquo;</p>
            <p>Please check your details or add it manually.</p>
          </div>
          <ActionButton
            onClick={() => {
              setEntryMode("manual");
              setManualInfo((c) => ({ ...c, businessName: searchInput }));
              writeVendorDraft({
                ...readVendorDraft(),
                isManualEntry: true,
                currentStep: "manual-info",
              });
              setStep("manual-info");
              trackEvent(analyticsEvents.vendorManualAddStarted);
            }}
            className="w-full"
          >
            Add my business manually
          </ActionButton>
        </div>
      )}

      {/* ======== STEP: MATCH ======== */}
      {step === "match" && candidate && (
        <div className="mt-5 space-y-5">
          <div className="rounded-2xl border border-[#E7070380] bg-gray-50 px-5 py-5 text-center dark:border-[#E7070380] dark:bg-black/20">
            <p className="text-[17px] font-semibold text-gray-900 dark:text-white">
              {candidate.venue_name}
            </p>
            <p className="mt-1.5 text-[13px] text-gray-500 dark:text-white/55">
              {candidate.address ||
                `${candidate.area_neighborhood || "Midtown"}, ${candidate.city || "Houston"}`}
            </p>
          </div>
          <p className="text-center text-sm text-gray-500 dark:text-white/60">Is this your business?</p>
          <ActionButton
            onClick={() => void handleConfirmMatch()}
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Confirming..." : "Yes, This is my business"}
          </ActionButton>
          <button
            type="button"
            onClick={() => {
              setEntryMode("manual");
              setStep("not-found");
              trackEvent(analyticsEvents.vendorBusinessRejected, {
                matchedBusinessId: getVenueId(candidate),
              });
            }}
            className="w-full py-3 text-center text-[14px] text-gray-500 transition hover:text-gray-600 dark:text-white/60 dark:hover:text-white/80"
          >
            My business isn&apos;t listed
          </button>
        </div>
      )}

      {/* ======== STEP: CONTACT ======== */}
      {step === "contact" && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const errors: Record<string, string> = {};
            if (!contact.firstName.trim()) errors.firstName = "First name is required.";
            else if (contact.firstName.trim().length > CONTACT_NAME_MAX) {
              errors.firstName = `First name must be ${CONTACT_NAME_MAX} characters or fewer.`;
            }
            if (!contact.lastName.trim()) errors.lastName = "Last name is required.";
            else if (contact.lastName.trim().length > CONTACT_NAME_MAX) {
              errors.lastName = `Last name must be ${CONTACT_NAME_MAX} characters or fewer.`;
            }
            if (!isEmailValid(contact.email)) errors.email = "Enter a valid email address.";
            if (contact.phone.trim() && !isPhoneValid(contact.phone.trim())) {
              errors.phone = "Enter a valid phone number.";
            }
            if (Object.keys(errors).length > 0) {
              setContactFieldErrors(errors);
              setStatusMessage(null);
              return;
            }
            setContactFieldErrors({});
            setStatusMessage(null);
            void handleContactSubmit();
          }}
        >
          <VendorInput value={contact.firstName} placeholder="First Name" maxLength={CONTACT_NAME_MAX} error={contactFieldErrors.firstName} onChange={(v) => setContact((c) => ({ ...c, firstName: v }))} />
          <VendorInput value={contact.lastName} placeholder="Last Name" maxLength={CONTACT_NAME_MAX} error={contactFieldErrors.lastName} onChange={(v) => setContact((c) => ({ ...c, lastName: v }))} />
          <VendorInput type="email" value={contact.email} placeholder="Email" error={contactFieldErrors.email} onChange={(v) => setContact((c) => ({ ...c, email: v }))} />
          <VendorInput value={contact.phone} placeholder="Phone (optional)" maxLength={20} error={contactFieldErrors.phone} onChange={(v) => setContact((c) => ({ ...c, phone: v }))} />
          <p className="text-[13px] text-gray-400 dark:text-white/42">
            We&apos;ll only use this to contact you about your account.
          </p>
          <ActionButton type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Next"}
          </ActionButton>
        </form>
      )}

      {/* ======== STEP: Photos (claim/match path) ======== */}
      {step === "photos" && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            writeVendorDraft({ ...readVendorDraft(), currentStep: "plan" });
            setStep("plan");
          }}
        >
          <VenuePhotoPicker
            photos={onboardingPhotos}
            onChange={setOnboardingPhotos}
            onUploadingChange={setPhotosUploading}
          />
          <ActionButton type="submit" className="w-full" disabled={photosUploading}>
            {photosUploading
              ? "Uploading photos…"
              : onboardingPhotos.length > 0
                ? "Next"
                : "Skip for now"}
          </ActionButton>
        </form>
      )}

      {/* ======== STEP: MANUAL — Business Info ======== */}
      {step === "manual-info" && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (!manualInfo.businessName.trim()) {
              setStatusMessage("Business name is required.");
              return;
            }
            setStatusMessage(null);
            setStep("manual-location");
          }}
        >
          <VendorInput label="Business Name" value={manualInfo.businessName} placeholder="Business Name" onChange={(v) => setManualInfo((c) => ({ ...c, businessName: v }))} />
          <SelectInput label="Category / Type" value={manualInfo.category} placeholder="restaurant, bar, & grill" options={["Restaurant", "Bar", "Lounge", "Club", "Cafe", "Food Truck", "Other"]} onChange={(v) => setManualInfo((c) => ({ ...c, category: v }))} />
          <VendorInput label="Website" value={manualInfo.website} placeholder="Website" type="url" onChange={(v) => setManualInfo((c) => ({ ...c, website: v }))} />
          <VendorInput label="Reservation Link (if available)" value={manualInfo.reservationUrl} placeholder="Reservation URL" type="url" onChange={(v) => setManualInfo((c) => ({ ...c, reservationUrl: v }))} />
          <VendorInput label="Instagram" value={manualInfo.instagram} placeholder="Instagram" onChange={(v) => setManualInfo((c) => ({ ...c, instagram: v }))} />
          <ActionButton type="submit" className="w-full">Next</ActionButton>
        </form>
      )}

      {/* ======== STEP: MANUAL — Location ======== */}
      {step === "manual-location" && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (!manualLocation.address.trim()) {
              setStatusMessage("Street address is required.");
              return;
            }
            if (!manualLocation.city.trim()) {
              setStatusMessage("City is required.");
              return;
            }
            if (!manualLocation.state.trim()) {
              setStatusMessage("State is required.");
              return;
            }
            if (!/^\d{5}(-\d{4})?$/.test(manualLocation.zip.trim())) {
              setStatusMessage("Enter a valid 5-digit zip code.");
              return;
            }
            setStatusMessage(null);
            setStep("manual-profile");
          }}
        >
          <VendorInput label="Street Address" value={manualLocation.address} placeholder="Street Address" onChange={(v) => setManualLocation((c) => ({ ...c, address: v }))} />
          <VendorInput label="City" value={manualLocation.city} placeholder="City" onChange={(v) => setManualLocation((c) => ({ ...c, city: v }))} />
          <VendorInput label="State" value={manualLocation.state} placeholder="State" onChange={(v) => setManualLocation((c) => ({ ...c, state: v }))} />
          <VendorInput label="Zip" value={manualLocation.zip} placeholder="Zip" maxLength={10} onChange={(v) => setManualLocation((c) => ({ ...c, zip: v }))} />
          <VendorInput label="Neighborhood" value={manualLocation.neighborhood} placeholder="Neighborhood" onChange={(v) => setManualLocation((c) => ({ ...c, neighborhood: v }))} />
          <ActionButton type="submit" className="w-full">Next</ActionButton>
        </form>
      )}

      {/* ======== STEP: MANUAL — Genie Profile ======== */}
      {step === "manual-profile" && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            setStep("manual-contact");
          }}
        >
          <VendorInput label="Short Description / Vibe" value={manualProfile.shortDescription} placeholder="Short Description / Vibe" onChange={(v) => setManualProfile((c) => ({ ...c, shortDescription: v }))} />
          <SelectInput label="Price Band" value={manualProfile.priceBand} placeholder="$, $$, $$$, $$$$ - (Optional)" options={["$", "$$", "$$$", "$$$$"]} onChange={(v) => setManualProfile((c) => ({ ...c, priceBand: v }))} />
          <VenuePhotoPicker
            photos={onboardingPhotos}
            onChange={setOnboardingPhotos}
            onUploadingChange={setPhotosUploading}
          />
          <ActionButton type="submit" className="w-full" disabled={photosUploading}>
            {photosUploading ? "Uploading photos…" : "Next"}
          </ActionButton>
        </form>
      )}

      {/* ======== STEP: MANUAL — Contact Info ======== */}
      {step === "manual-contact" && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const errors: Record<string, string> = {};
            if (!manualContact.firstName.trim()) errors.firstName = "First name is required.";
            else if (manualContact.firstName.trim().length > CONTACT_NAME_MAX) {
              errors.firstName = `First name must be ${CONTACT_NAME_MAX} characters or fewer.`;
            }
            if (!manualContact.lastName.trim()) errors.lastName = "Last name is required.";
            else if (manualContact.lastName.trim().length > CONTACT_NAME_MAX) {
              errors.lastName = `Last name must be ${CONTACT_NAME_MAX} characters or fewer.`;
            }
            if (!isEmailValid(manualContact.email)) errors.email = "Enter a valid email address.";
            if (manualContact.phone.trim() && !isPhoneValid(manualContact.phone.trim())) {
              errors.phone = "Enter a valid phone number.";
            }
            if (Object.keys(errors).length > 0) {
              setManualContactFieldErrors(errors);
              setStatusMessage(null);
              return;
            }
            setManualContactFieldErrors({});
            setStatusMessage(null);
            setEntryMode("manual");
            setStep("plan");
          }}
        >
          <VendorInput label="First Name" value={manualContact.firstName} placeholder="First Name" maxLength={CONTACT_NAME_MAX} error={manualContactFieldErrors.firstName} onChange={(v) => setManualContact((c) => ({ ...c, firstName: v }))} />
          <VendorInput label="Last Name" value={manualContact.lastName} placeholder="Last Name" maxLength={CONTACT_NAME_MAX} error={manualContactFieldErrors.lastName} onChange={(v) => setManualContact((c) => ({ ...c, lastName: v }))} />
          <VendorInput label="Email" type="email" value={manualContact.email} placeholder="Email" error={manualContactFieldErrors.email} onChange={(v) => setManualContact((c) => ({ ...c, email: v }))} />
          <VendorInput label="Phone" value={manualContact.phone} placeholder="Phone" maxLength={20} error={manualContactFieldErrors.phone} onChange={(v) => setManualContact((c) => ({ ...c, phone: v }))} />
          <VendorInput label="Role / Title" value={manualContact.roleTitle} placeholder="Role / Title" maxLength={CONTACT_NAME_MAX} onChange={(v) => setManualContact((c) => ({ ...c, roleTitle: v }))} />
          <ActionButton type="submit" className="w-full">Next</ActionButton>
        </form>
      )}

      {/* ======== STEP: PLAN ======== */}
      {step === "plan" && (
        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => {
              setSelectedPlan("basic");
              writeVendorDraft({ ...readVendorDraft(), selectedPlanId: "basic" });
              trackEvent(analyticsEvents.vendorPlanSelected, { planId: "basic" });
            }}
            className={`w-full rounded-2xl border p-5 text-left transition ${
              selectedPlan === "basic"
                ? "border-red-500/60 bg-red-50 shadow-[0_0_24px_rgba(220,38,38,0.08)] dark:border-red-500/40 dark:bg-red-900/20"
                : "border-[#E7070380] bg-white dark:border-[#E7070380] dark:bg-black/20"
            }`}
          >
            <p className="text-[16px] font-bold text-gray-900 dark:text-white">Basic — Claim Your Spot</p>
            <p className="mt-0.5 text-[14px] font-semibold text-gray-500 dark:text-white/55">Free</p>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-white/60">
              Get discovered on Genie with your basic listing and customer actions.
            </p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-gray-600 dark:text-white/72">
              {config.vendorPlans.basicBenefits.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-none text-red-600 dark:text-[#ff7b7b]">•</span>{b}
                </li>
              ))}
            </ul>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedPlan("pro");
              writeVendorDraft({ ...readVendorDraft(), selectedPlanId: "pro" });
              trackEvent(analyticsEvents.vendorPlanSelected, { planId: "pro" });
            }}
            className={`w-full rounded-2xl border p-5 text-left transition ${
              selectedPlan === "pro"
                ? "border-red-500/60 bg-red-50 shadow-[0_0_24px_rgba(220,38,38,0.08)] dark:border-red-500/40 dark:bg-red-900/20"
                : "border-[#E7070380] bg-white dark:border-[#E7070380] dark:bg-black/20"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[16px] font-bold text-gray-900 dark:text-white">Pro — Get More Visibility</p>
                <p className="mt-0.5 text-[14px] font-semibold text-red-600 dark:text-[#ff7b7b]">{config.vendorPlans.proMonthly}</p>
              </div>
              <span className="flex-none rounded-full bg-[#22c55e] px-2.5 py-1 text-[11px] font-bold text-white">Best Value</span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-white/60">{config.vendorPlans.proDescription}</p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-gray-600 dark:text-white/72">
              {config.vendorPlans.proBenefits.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-none text-red-600 dark:text-[#ff7b7b]">•</span>{b}
                </li>
              ))}
            </ul>
          </button>

          <div className="pt-1">
            <ActionButton
              onClick={() => void completeRegistration()}
              className="w-full"
              disabled={isSubmitting || !selectedPlan}
            >
              {isSubmitting ? "Submitting..." : "Continue"}
            </ActionButton>
          </div>
        </div>
      )}

      {/* ======== STEP: SUCCESS ======== */}
      {step === "success" && (
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="flex h-36 w-36 items-center justify-center rounded-full border border-[#E7070380] bg-red-50 dark:border-[#E7070380] dark:bg-red-900/30">
            <svg viewBox="0 0 24 24" className="h-16 w-16 text-red-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5L20 7" />
            </svg>
          </div>
          <h2 className="mt-7 text-[1.65rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Welcome to Genie {selectedPlan === "pro" ? "Pro" : ""}
          </h2>
          <p className="mt-2 text-[15px] text-gray-500 dark:text-white/60">Your business is live!</p>
          <p className="mt-4 text-[14px] leading-relaxed text-gray-500 dark:text-white/60">
            Your listing is now discoverable by people searching for spots like yours on Genie.
            Check your dashboard to see how you&apos;re performing.
          </p>
          <div className="mt-8 w-full">
            <ActionButton
              onClick={() => {
                trackEvent(analyticsEvents.vendorSuccessContinueTapped);
                setStep("dashboard");
              }}
              className="w-full"
            >
              Go to Dashboard
            </ActionButton>
          </div>
        </div>
      )}

      {/* ======== STEP: DASHBOARD ======== */}
      {step === "dashboard" && (
        <div className="mt-2">
          {isDashboardLoading && !dashboardData ? (
            <div className="flex min-h-[12rem] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-red-600" />
            </div>
          ) : dashboardData ? (
            (() => {
              const d = dashboardData;
              const rating = typeof d.rating === "number" ? d.rating : 4.0;
              const address = d.address || "";
              const isClaimed = d.is_claimed ?? d.is_live;
              const genieAppearances = d.total_genie_appearances ?? 0;
              const profileViews = d.total_profile_views ?? 0;
              const totalActions = d.total_actions ?? 0;
              const callClicks = d.total_call_clicks ?? 0;
              const mapClicks = d.total_map_clicks ?? 0;
              const reservationClicks = d.total_reservation_clicks ?? 0;
              const userSaved = d.total_saves ?? 0;
              // Real 7-day engagement-rate trend from genie_vendor_analytics,
              // via the dashboard performance loader above. No fallback to
              // fake data — an empty/loading vendor just shows an empty chart.
              const performancePoints = [...dashboardPerfDaily]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((record) => ({ value: (record.engagement_rate ?? 0) * 100 }));
              const performanceMinLabel =
                performancePoints.length > 0
                  ? `${Math.round(Math.min(...performancePoints.map((p) => p.value)))}%`
                  : "0%";
              const totalActionsThisWeek = dashboardPerfTotals?.total_actions ?? 0;
              const dailyAverageActions =
                dashboardPerfDaily.length > 0
                  ? Math.round(totalActionsThisWeek / dashboardPerfDaily.length)
                  : 0;
              const boostActive = Boolean(d.boost_active);
              const boostAmount = d.boost_amount ?? 0;
              const boostPeriodLabel = d.boost_period_label || "Today";

              return (
                <div className="space-y-5 pb-28">
                  {/* ── Header: logo + name + stars + claimed + address ── */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl border border-[#E7070380] bg-white/5 dark:bg-black/25">
                      {d.logo_url ? (
                        <Image
                          src={d.logo_url}
                          alt=""
                          width={48}
                          height={48}
                          className="h-10 w-10 object-contain"
                        />
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-8 w-8 text-[#ff8a8a]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 9h16" />
                          <path d="M4 13h16" />
                          <path d="M4 17h16" />
                          <path d="M6 7l.6-2a1 1 0 0 1 1-.8h8.8a1 1 0 0 1 1 .8L18 7" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <h1 className="text-[1.35rem] font-semibold text-gray-900 dark:text-white">
                          {d.business_name}
                        </h1>
                        {isClaimed ? (
                          <span className="inline-flex items-center gap-1 text-[0.78rem] font-medium text-green-500 dark:text-[#58d27b]">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 dark:bg-[#34c059]">
                              <svg
                                viewBox="0 0 24 24"
                                className="h-3 w-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M5 12.5l4 4 10-10" />
                              </svg>
                            </span>
                            Claimed
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span
                          className="text-[0.95rem] text-[#f5b700]"
                          aria-label={`${rating.toFixed(1)} star rating`}
                        >
                          {renderStars(rating)}
                          <span className="text-gray-300 dark:text-white/25">
                            {"★".repeat(Math.max(0, 5 - Math.ceil(rating)))}
                          </span>
                        </span>
                        <span className="text-[0.78rem] text-gray-500 dark:text-white/55">
                          {rating.toFixed(1)} Stars
                        </span>
                      </div>
                      {address ? (
                        <p className="mt-1 text-[0.78rem] leading-snug text-gray-500 dark:text-white/55">
                          {address}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* ── Top-row stats (shared by Free + Paid) ── */}
                  <div className="grid grid-cols-3 gap-2">
                    <BigStat label="Genie Appearances" value={genieAppearances} />
                    <BigStat label="Profile Views" value={profileViews} />
                    <BigStat
                      label="Total Customer Actions"
                      value={totalActions}
                    />
                  </div>

                  {/* ── PRO-only second-row micro stats + chart ── */}
                  {isPro ? (
                    <>
                      <div className="grid grid-cols-4 gap-2">
                        <MicroStat label="Call Clicks" value={callClicks} />
                        <MicroStat label="Map Clicks" value={mapClicks} />
                        <MicroStat
                          label="Reservation Clicks"
                          value={reservationClicks}
                        />
                        <MicroStat label="User Saved" value={userSaved} />
                      </div>

                      <div>
                        {isDashboardPerfLoading ? (
                          <p className="py-6 text-center text-[0.85rem] text-gray-400 dark:text-white/50">
                            Loading performance…
                          </p>
                        ) : (
                          <PerformanceChart
                            points={performancePoints}
                            minLabel={performanceMinLabel}
                            headLabel="7 Days"
                          />
                        )}
                        <div className="mt-2 flex items-center justify-between px-1 text-[0.82rem] font-semibold text-[#e8900a]">
                          <span>{totalActionsThisWeek}</span>
                          <span>{dailyAverageActions}</span>
                          <span>All Time</span>
                        </div>
                      </div>
                    </>
                  ) : null}

                  {/* ── Widgets: check-ins today | active offers | open-closed ── */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-3 py-4 text-center dark:bg-black/25">
                      <p className="text-[1.35rem] font-bold text-gray-900 dark:text-white">
                        {d.checkins_today ?? 0}
                      </p>
                      <p className="mt-0.5 text-[0.72rem] text-gray-500 dark:text-white/55">
                        Check-ins Today
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setStep("offers")}
                      className="rounded-2xl border border-[#E7070380] bg-white/5 px-3 py-4 text-center transition hover:bg-white/10 dark:bg-black/25 dark:hover:bg-black/35"
                    >
                      <p className="text-[1.35rem] font-bold text-gray-900 dark:text-white">
                        {d.offer_count ?? 0}
                      </p>
                      <p className="mt-0.5 text-[0.72rem] text-gray-500 dark:text-white/55">
                        Active Offers
                      </p>
                    </button>

                    {(() => {
                      const isOpen = d.is_open_now ?? false;
                      return (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isOpen}
                          aria-label="We're open"
                          disabled={isOpenToggleSaving}
                          onClick={() => void toggleOpenNow(!isOpen)}
                          className="flex flex-col items-center justify-center rounded-2xl border border-[#E7070380] bg-white/5 px-3 py-4 transition hover:bg-white/10 disabled:opacity-50 dark:bg-black/25 dark:hover:bg-black/35"
                        >
                          <span
                            className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${
                              isOpen
                                ? "bg-green-500 dark:bg-[#34c059]"
                                : "bg-gray-300 dark:bg-white/25"
                            }`}
                          >
                            <span
                              className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                isOpen ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </span>
                          <p className="mt-1.5 text-[0.72rem] text-gray-500 dark:text-white/55">
                            {isOpen ? "We're Open" : "We're Closed"}
                          </p>
                        </button>
                      );
                    })()}
                  </div>

                  {/* ── Events & Posts (venue owner's own — acting_as: "venue") ── */}
                  <button
                    type="button"
                    onClick={openMyContent}
                    disabled={!isClaimed}
                    className="flex w-full items-center justify-between rounded-2xl border border-[#E7070380] bg-white/5 px-5 py-4 text-left transition hover:bg-white/10 disabled:opacity-50 dark:bg-black/25 dark:hover:bg-black/35"
                  >
                    <div>
                      <p className="text-[1rem] font-semibold text-gray-900 dark:text-white">
                        Events & Posts
                      </p>
                      <p className="mt-0.5 text-[0.78rem] text-gray-500 dark:text-white/55">
                        {!isClaimed
                          ? "Claim your venue to create events and posts."
                          : `${vendorEvents.length} events · ${vendorPosts.length} posts`}
                      </p>
                    </div>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-none text-gray-400 dark:text-white/40">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* ── Business Details ── */}
                  <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-5 dark:bg-black/25">
                    <div className="flex items-center justify-between py-4">
                      <p className="text-[1rem] font-semibold text-gray-900 dark:text-white">
                        Business Details
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setStep("profile");
                          setProfileMessage(null);
                        }}
                        aria-label="Edit Business Profile"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition hover:bg-red-700"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                    </div>
                    <DetailRow label="Website" value={d.website} withDivider />
                    <DetailRow
                      label="Reservation"
                      value={d.reservation_url}
                      withDivider
                    />
                    <DetailRow
                      label="Category, Cuisine"
                      value={
                        [d.category, d.cuisine].filter(Boolean).join(", ") ||
                        null
                      }
                      withDivider
                    />
                    <div className="pb-4">
                      <DetailRow
                        label="Instagram"
                        value={d.instagram}
                        withDivider
                      />
                    </div>
                  </div>

                  {/* ── Quick Actions grid ── */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Analytics", icon: (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-6"/></svg>
                      ), step: "analytics" as VendorStep },
                      { label: "Manage Offers", icon: (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
                      ), step: "offers" as VendorStep },
                      { label: "Influencer Codes", icon: (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      ), step: "influencer-codes" as VendorStep },
                      { label: "Settings", icon: (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                      ), step: "settings" as VendorStep },
                    ].map(({ label, icon, step: target }) => (
                      <button
                        key={target}
                        type="button"
                        onClick={() => setStep(target)}
                        className="flex items-center gap-3 rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 text-left transition hover:bg-white/10 dark:bg-black/20 dark:hover:bg-black/30"
                      >
                        <span className="text-red-500 dark:text-[#ff7b7b]">{icon}</span>
                        <span className="text-[0.88rem] font-medium text-gray-800 dark:text-white">{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* ── Bottom section: Pro → Boost status | Free → Upgrade + Boost CTAs ── */}
                  {isPro ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <p className="text-[1rem] font-semibold text-gray-900 dark:text-white">
                          {boostActive ? "Boost is Active" : "Boost"}
                          {boostActive ? (
                            <span className="ml-2 text-red-500 dark:text-[#ff5a5a]">
                              ${boostAmount.toFixed(2)}
                            </span>
                          ) : null}
                        </p>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[0.9rem] font-medium text-gray-600 dark:text-white/70"
                        >
                          {boostPeriodLabel}
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <path d="m9 6 6 6-6 6" />
                          </svg>
                        </button>
                      </div>
                      <ActionButton
                        onClick={() => setStep("boost")}
                        className="w-full"
                      >
                        Boost your listing
                      </ActionButton>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-center text-[0.95rem] font-medium text-gray-600 dark:text-white/70">
                        Unlock more insights & boost your business
                      </p>
                      <ActionButton
                        onClick={() => setStep("boost")}
                        className="w-full"
                      >
                        Upgrade to Pro
                      </ActionButton>
                      <ActionButton
                        onClick={() => setStep("boost")}
                        variant="secondary"
                        className="w-full"
                      >
                        Boost your business
                      </ActionButton>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-500 dark:text-white/60">
                Could not load dashboard data.
              </p>
              <ActionButton
                onClick={() => void loadDashboard()}
                variant="secondary"
                className="w-full"
              >
                Try again
              </ActionButton>
            </div>
          )}
        </div>
      )}

      {/* ======== STEP: PROFILE EDIT ======== */}
      {step === "profile" && (
        <form
          className={`mt-6 space-y-4 ${isProfileLoading ? "opacity-60" : ""}`}
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            void handleSaveProfile();
          }}
        >
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
              Business Description
            </label>
            <textarea
              value={profileForm.description}
              onChange={(e) =>
                setProfileForm((c) => ({ ...c, description: e.target.value }))
              }
              placeholder="An upscale poolside nightclub with craft cocktails..."
              rows={3}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
            />
          </div>
          <VendorInput value={profileForm.phone} placeholder="Phone number" onChange={(v) => setProfileForm((c) => ({ ...c, phone: v }))} />
          <VendorInput value={profileForm.website_url} placeholder="Website URL" type="url" onChange={(v) => setProfileForm((c) => ({ ...c, website_url: v }))} />
          <VendorInput value={profileForm.reservation_url} placeholder="Reservation URL" type="url" onChange={(v) => setProfileForm((c) => ({ ...c, reservation_url: v }))} />
          <VendorInput value={profileForm.hours} placeholder="Hours (e.g. Open Until 2 AM)" onChange={(v) => setProfileForm((c) => ({ ...c, hours: v }))} />
          <VenuePhotoPicker
            photos={venuePhotos}
            onChange={setVenuePhotos}
            onUploadingChange={setVenuePhotosUploading}
            label="Venue photos"
          />

          <ActionButton
            type="submit"
            className="w-full"
            disabled={isProfileSaving || venuePhotosUploading}
          >
            {venuePhotosUploading
              ? "Uploading photos…"
              : isProfileSaving
                ? "Saving..."
                : "Save Profile"}
          </ActionButton>
          <ActionButton onClick={() => { setStep("dashboard"); setProfileMessage(null); }} variant="secondary" className="w-full">
            Back to Dashboard
          </ActionButton>

          {profileMessage && (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${
              profileMessage.includes("success")
                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-900/20 dark:text-green-400"
                : "border-[#E7070380] bg-gray-50 text-gray-500 dark:border-[#E7070380] dark:bg-black/20 dark:text-white/60"
            }`}>
              {profileMessage}
            </div>
          )}
        </form>
      )}

      {/* ======== STEP: ANALYTICS ======== */}
      {step === "analytics" && (() => {
        const periodLabel =
          analyticsPeriod === "7_days" ? "Last 7 Days" : analyticsPeriod === "30_days" ? "Last 30 Days" : "All Time";
        const appearancesPoints = analyticsDaily.map((r) => r.genie_appearances ?? 0);
        const savesPoints = analyticsDaily.map((r) => r.saves ?? 0);
        const profileViewsPoints = analyticsDaily.map((r) => r.profile_views ?? 0);
        const hasData = analyticsDaily.length > 0;

        return (
          <div className="mt-2 space-y-6 pb-28">
            {/* Period selector */}
            <div className="flex gap-2">
              {(["7_days","30_days","all_time"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAnalyticsPeriod(p)}
                  className={`flex-1 rounded-xl py-2 text-[0.8rem] font-semibold transition ${
                    analyticsPeriod === p
                      ? "bg-red-600 text-white"
                      : "border border-[#E7070380] text-gray-500 dark:text-white/60"
                  }`}
                >
                  {p === "7_days" ? "7 Days" : p === "30_days" ? "30 Days" : "All Time"}
                </button>
              ))}
            </div>

            {isAnalyticsLoading ? (
              <p className="py-8 text-center text-[0.85rem] text-gray-400 dark:text-white/50">Loading analytics…</p>
            ) : !hasData ? (
              <p className="py-8 text-center text-[0.85rem] text-gray-400 dark:text-white/50">No analytics data yet for this period.</p>
            ) : (
              <>
                {/* Line chart: Genie Appearances */}
                <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 dark:bg-black/20">
                  <p className="mb-2 text-[0.82rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/55">Genie Appearances</p>
                  <PerformanceChart points={appearancesPoints.map((v) => ({ value: v }))} headLabel={periodLabel} />
                  <p className="mt-1 text-right text-[1.1rem] font-bold text-gray-900 dark:text-white">{(analyticsTotals?.genie_appearances ?? appearancesPoints.reduce((a,b) => a+b,0)).toLocaleString()} total</p>
                </div>

                {/* Line chart: Saves */}
                <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 dark:bg-black/20">
                  <p className="mb-2 text-[0.82rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/55">Saves</p>
                  <PerformanceChart points={savesPoints.map((v) => ({ value: v }))} headLabel={periodLabel} />
                  <p className="mt-1 text-right text-[1.1rem] font-bold text-gray-900 dark:text-white">{(analyticsTotals?.saves ?? savesPoints.reduce((a,b) => a+b,0)).toLocaleString()} total</p>
                </div>

                {/* Line chart: Profile Views */}
                <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 dark:bg-black/20">
                  <p className="mb-2 text-[0.82rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/55">Profile Views</p>
                  <PerformanceChart points={profileViewsPoints.map((v) => ({ value: v }))} headLabel={periodLabel} />
                  <p className="mt-1 text-right text-[1.1rem] font-bold text-gray-900 dark:text-white">{(analyticsTotals?.profile_views ?? profileViewsPoints.reduce((a,b) => a+b,0)).toLocaleString()} total</p>
                </div>

                {/* Engagement summary */}
                {analyticsTotals ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-3 dark:bg-black/20">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/55">Call Clicks</p>
                      <p className="mt-1 text-[1.1rem] font-bold text-gray-900 dark:text-white">{analyticsTotals.call_clicks.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-3 dark:bg-black/20">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/55">Map Clicks</p>
                      <p className="mt-1 text-[1.1rem] font-bold text-gray-900 dark:text-white">{analyticsTotals.map_clicks.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-3 dark:bg-black/20">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/55">Reservation Clicks</p>
                      <p className="mt-1 text-[1.1rem] font-bold text-gray-900 dark:text-white">{analyticsTotals.reservation_clicks.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-3 dark:bg-black/20">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/55">Engagement Rate</p>
                      <p className="mt-1 text-[1.1rem] font-bold text-gray-900 dark:text-white">{(analyticsTotals.engagement_rate * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        );
      })()}

      {/* ======== STEP: OFFERS ======== */}
      {step === "offers" && (() => {
        const offers = dashboardData?.offers ?? [];
        // Mirror Xano's gates on genie/vendor_create_offer: the vendor must be
        // live and on the founding-partner plan, or the create call comes back
        // as an indistinguishable `unauthorized`.
        const isLive = Boolean(dashboardData?.is_live);
        return (
          <div className="mt-2 space-y-4 pb-28">
            {/* Create an offer — Pro + live vendors only */}
            {isPro ? (
              <div className="space-y-2">
                <ActionButton
                  onClick={() => { setOfferFieldErrors({}); setStep("create-offer"); }}
                  className="w-full"
                  disabled={!isLive}
                >
                  + Create an Offer
                </ActionButton>
                {!isLive && (
                  <p className="px-1 text-[0.78rem] text-gray-500 dark:text-white/50">
                    Your listing needs to be active before you can publish offers.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2 rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 dark:bg-black/20">
                <p className="text-[0.88rem] font-semibold text-gray-900 dark:text-white">
                  Create your own offers
                </p>
                <p className="text-[0.8rem] text-gray-500 dark:text-white/55">
                  Publishing offers is a Pro Genie Vendor feature.
                </p>
                <ActionButton
                  onClick={() => setStep("plan")}
                  className="w-full"
                >
                  Upgrade to Pro
                </ActionButton>
              </div>
            )}

            {/* Influencer offers — Active / Pending / Rejected */}
            {(() => {
              const statusOf = (o: InfluencerOffer) =>
                (o.status ?? "pending").toLowerCase();
              const counts = {
                active: influencerOffers.filter((o) => statusOf(o) === "active")
                  .length,
                pending: influencerOffers.filter(
                  (o) => statusOf(o) === "pending"
                ).length,
                rejected: influencerOffers.filter(
                  (o) => statusOf(o) === "rejected"
                ).length,
                cancelled: influencerOffers.filter(
                  (o) => statusOf(o) === "cancelled"
                ).length,
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
              const filtered = influencerOffers.filter(
                (o) => statusOf(o) === vendorOfferFilter
              );
              return (
                <div className="space-y-3">
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-red-500 dark:text-[#ff7b7b]">
                    Influencer Offers
                  </p>

                  {/* Segmented tab bar with a sliding red indicator */}
                  <div className="relative flex rounded-full border border-[#E7070380] bg-white/5 p-1 dark:bg-black/20">
                    {/* sliding pill — moves to the active tab */}
                    <span
                      aria-hidden
                      className="absolute top-1 bottom-1 rounded-full bg-red-600 transition-transform duration-300 ease-out"
                      style={{
                        width: "calc((100% - 0.5rem) / 4)",
                        left: "0.25rem",
                        transform: `translateX(${
                          tabs.findIndex((t) => t.key === vendorOfferFilter) * 100
                        }%)`,
                      }}
                    />
                    {tabs.map((tab) => {
                      const isActive = vendorOfferFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setVendorOfferFilter(tab.key)}
                          className={`relative z-10 flex-1 rounded-full px-1 py-1.5 text-[0.72rem] font-semibold transition-colors duration-300 ${
                            isActive
                              ? "text-white"
                              : "text-gray-500 dark:text-white/60"
                          }`}
                        >
                          {tab.label}
                          {counts[tab.key] > 0 ? ` (${counts[tab.key]})` : ""}
                        </button>
                      );
                    })}
                  </div>

                  {isLoadingPending ? (
                    <div className="flex min-h-[6rem] items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-red-600" />
                    </div>
                  ) : pendingError ? (
                    <p className="rounded-2xl border border-red-300/70 bg-red-50/60 px-4 py-3 text-[0.8rem] text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-300">
                      {pendingError}
                    </p>
                  ) : filtered.length === 0 ? (
                    <p className="rounded-2xl border border-gray-200 bg-white/5 px-4 py-3 text-center text-[0.82rem] text-gray-400 dark:border-white/10 dark:text-white/40">
                      {vendorOfferFilter === "pending"
                        ? "No pending requests."
                        : vendorOfferFilter === "active"
                          ? "No active offers."
                          : vendorOfferFilter === "rejected"
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
                      const isRejecting = rejectingOfferId === offer.id;
                      const isBusy = reviewingOfferId === offer.id;
                      const cardTone =
                        status === "active"
                          ? "border-green-300/70 bg-green-50/60 dark:border-green-500/30 dark:bg-green-500/5"
                          : status === "rejected"
                            ? "border-red-300/70 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/5"
                            : status === "cancelled"
                              ? "border-gray-300/70 bg-gray-100/60 dark:border-white/15 dark:bg-white/5"
                              : "border-amber-300/70 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5";
                      return (
                        <div
                          key={offer.id}
                          className={`rounded-2xl border px-4 py-4 ${cardTone}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.9rem] font-semibold text-gray-900 dark:text-white">
                                {offer.offer_title}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="text-[0.72rem] capitalize text-gray-500 dark:text-white/50">
                                  {offer.offer_type?.replace(/_/g, " ")}
                                </span>
                                {discount ? (
                                  <span className="text-[0.72rem] font-semibold text-red-600 dark:text-[#ff7b7b]">
                                    {discount} off
                                  </span>
                                ) : null}
                              </div>
                              {offer.offer_description ? (
                                <p className="mt-1.5 text-[0.78rem] text-gray-500 dark:text-white/50">
                                  {offer.offer_description}
                                </p>
                              ) : null}
                              {offer.promo_code ? (
                                <p className="mt-1.5 text-[0.72rem] font-bold uppercase tracking-wider text-red-600 dark:text-[#ff7b7b]">
                                  {offer.promo_code}
                                </p>
                              ) : null}
                              {(status === "rejected" ||
                                status === "cancelled") &&
                              offer.rejection_reason ? (
                                <p className="mt-1.5 text-[0.72rem] text-red-600 dark:text-red-300">
                                  Reason: {offer.rejection_reason}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          {status === "pending" &&
                            (isRejecting ? (
                              <div className="mt-3 space-y-2">
                                <VendorInput
                                  value={rejectReason}
                                  placeholder="Reason for rejection (optional)"
                                  onChange={setRejectReason}
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void handleReviewOffer(
                                        offer.id,
                                        "reject",
                                        rejectReason.trim() || undefined
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
                                      setRejectingOfferId(null);
                                      setRejectReason("");
                                    }}
                                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-[0.78rem] font-medium text-gray-600 dark:border-white/20 dark:text-white/70"
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
                                  onClick={() =>
                                    void handleReviewOffer(offer.id, "approve")
                                  }
                                  className="flex-1 rounded-lg border border-green-500 bg-green-600 px-3 py-2 text-[0.78rem] font-semibold text-white disabled:opacity-60"
                                >
                                  {isBusy ? "…" : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    setRejectingOfferId(offer.id);
                                    setRejectReason("");
                                  }}
                                  className="flex-1 rounded-lg border border-[#E7070380] px-3 py-2 text-[0.78rem] font-medium text-gray-600 dark:text-white/70"
                                >
                                  Reject
                                </button>
                              </div>
                            ))}

                          {status === "active" &&
                            (isRejecting ? (
                              <div className="mt-3 space-y-2">
                                <VendorInput
                                  value={rejectReason}
                                  placeholder="Reason for cancelling (optional)"
                                  onChange={setRejectReason}
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void handleReviewOffer(
                                        offer.id,
                                        "cancel",
                                        rejectReason.trim() || undefined
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
                                      setRejectingOfferId(null);
                                      setRejectReason("");
                                    }}
                                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-[0.78rem] font-medium text-gray-600 dark:border-white/20 dark:text-white/70"
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
                                    setRejectingOfferId(offer.id);
                                    setRejectReason("");
                                  }}
                                  className="w-full rounded-lg border border-[#E7070380] px-3 py-2 text-[0.78rem] font-medium text-gray-600 dark:text-white/70"
                                >
                                  Cancel Offer
                                </button>
                              </div>
                            ))}
                        </div>
                      );
                    })
                  )}
                  <div className="h-px bg-gray-200 dark:bg-white/10" />
                </div>
              );
            })()}

            {/* Offer list */}
            <div className="space-y-3">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 dark:bg-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.9rem] font-semibold text-gray-900 dark:text-white">{offer.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${
                          offer.active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/40"
                        }`}>
                          {offer.active ? "Active" : "Inactive"}
                        </span>
                        <span className="text-[0.72rem] text-gray-400 dark:text-white/40 capitalize">{offer.offer_type?.replace(/_/g," ")}</span>
                      </div>
                      {offer.redeem_instructions && (
                        <p className="mt-1.5 text-[0.78rem] text-gray-500 dark:text-white/50">{offer.redeem_instructions}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {offerMessage && (
              <p className={`text-sm ${/could ?n[o']?t|failed|error|required|not found|unable/i.test(offerMessage) ? "text-red-500" : "text-green-500"}`}>{offerMessage}</p>
            )}
          </div>
        );
      })()}

      {/* ======== STEP: CREATE OFFER ======== */}
      {step === "create-offer" && (
        <form
          className="mt-6 space-y-4 pb-28"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            void handleCreateOffer();
          }}
        >
          <VendorInput
            label="Offer Title"
            value={offerForm.title}
            placeholder="Half-price cocktails, 4-7pm"
            maxLength={OFFER_TITLE_MAX}
            error={offerFieldErrors.title}
            onChange={(v) => setOfferForm((c) => ({ ...c, title: v }))}
          />

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
              Description
            </label>
            <textarea
              value={offerForm.description}
              onChange={(e) =>
                setOfferForm((c) => ({ ...c, description: e.target.value }))
              }
              placeholder="Tell Vibees what they get and when it's available..."
              rows={3}
              maxLength={OFFER_DESCRIPTION_MAX}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
            />
            {offerFieldErrors.description ? (
              <p className="mt-1.5 text-[0.78rem] text-red-500">{offerFieldErrors.description}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
              Offer Type
            </label>
            <select
              value={offerForm.offer_type}
              onChange={(e) =>
                setOfferForm((c) => ({
                  ...c,
                  offer_type: e.target.value as VendorOfferType,
                }))
              }
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] capitalize text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:focus:border-[#ff6a6a]"
            >
              {VENDOR_OFFER_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <VendorInput
            label="Discount (optional)"
            value={offerForm.discount_value}
            placeholder="e.g. 50% off, or $10"
            onChange={(v) => setOfferForm((c) => ({ ...c, discount_value: v }))}
          />

          <VendorInput
            label="How to Redeem (optional)"
            value={offerForm.redeem_instructions}
            placeholder="Show this offer to your server"
            onChange={(v) =>
              setOfferForm((c) => ({ ...c, redeem_instructions: v }))
            }
          />

          <VendorInput
            label="Link (optional)"
            value={offerForm.link_url}
            placeholder="https://..."
            type="url"
            error={offerFieldErrors.link_url}
            onChange={(v) => setOfferForm((c) => ({ ...c, link_url: v }))}
          />

          <VendorInput
            label="Redemption Limit (optional)"
            value={offerForm.redemption_limit}
            placeholder="Leave blank for unlimited"
            type="number"
            error={offerFieldErrors.redemption_limit}
            onChange={(v) =>
              setOfferForm((c) => ({ ...c, redemption_limit: v }))
            }
          />

          <label className="flex items-center gap-3 px-1">
            <input
              type="checkbox"
              checked={offerForm.vibee_only}
              onChange={(e) =>
                setOfferForm((c) => ({ ...c, vibee_only: e.target.checked }))
              }
              className="h-4 w-4 flex-none accent-red-600"
            />
            <span className="text-[0.85rem] text-gray-600 dark:text-white/70">
              Members only — restrict this offer to Vibees
            </span>
          </label>

          <ActionButton
            type="submit"
            className="w-full"
            disabled={isSavingOffer}
          >
            {isSavingOffer ? "Creating..." : "Create Offer"}
          </ActionButton>

          {offerMessage && (
            <div className="rounded-2xl border border-[#E7070380] bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-black/20 dark:text-white/60">
              {offerMessage}
            </div>
          )}
        </form>
      )}

      {/* ======== STEP: MY CONTENT (events + posts, acting_as: "venue") ======== */}
      {step === "my-content" && (
        <div className="mt-2 space-y-4 pb-28">
          <div className="flex gap-2 rounded-2xl border border-[#E7070380] bg-white/5 p-1 dark:bg-black/25">
            {(["events", "posts"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setContentTab(tab)}
                className={`flex-1 rounded-xl py-2 text-[0.85rem] font-semibold capitalize transition ${
                  contentTab === tab
                    ? "bg-red-600 text-white"
                    : "text-gray-500 dark:text-white/55"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <ActionButton
            onClick={contentTab === "events" ? openCreateEvent : openCreatePost}
            className="w-full"
          >
            + {contentTab === "events" ? "Create Event" : "Create Post"}
          </ActionButton>

          {contentMessage && (
            <p className="text-center text-sm text-gray-500 dark:text-white/55">
              {contentMessage}
            </p>
          )}

          {contentTab === "events" ? (
            vendorEventsLoading ? (
              <p className="py-8 text-center text-[0.85rem] text-gray-400 dark:text-white/50">
                Loading your events…
              </p>
            ) : vendorEvents.length === 0 ? (
              <p className="py-8 text-center text-[0.85rem] text-gray-400 dark:text-white/50">
                No events yet. Create your first one.
              </p>
            ) : (
              <div className="space-y-2">
                {vendorEvents.map((ev) => {
                  const isCancelled = ev.status === "cancelled";
                  return (
                    <div
                      key={ev.id}
                      className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-3.5 dark:bg-black/25"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[0.9rem] font-semibold text-gray-900 dark:text-white">
                          {ev.title}
                          {isCancelled ? (
                            <span className="ml-2 text-[0.72rem] font-normal text-gray-400 dark:text-white/40">
                              Cancelled
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[0.78rem] text-gray-500 dark:text-white/55">
                          {[formatEventDateLabel(ev.event_date), formatEventTimeRange(ev.start_time, ev.end_time)]
                            .filter(Boolean)
                            .join(" · ") || ev.category}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEditEvent(ev)}
                          className="text-[0.78rem] font-semibold text-red-600 dark:text-red-400"
                        >
                          Edit
                        </button>
                        {!isCancelled ? (
                          <button
                            type="button"
                            onClick={() => void handleVendorEventCancel(ev.id)}
                            disabled={eventActionBusyId === ev.id}
                            className="text-[0.78rem] font-semibold text-gray-500 dark:text-white/50 disabled:opacity-50"
                          >
                            {eventActionBusyId === ev.id ? "Cancelling…" : "Cancel"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : vendorPostsLoading ? (
            <p className="py-8 text-center text-[0.85rem] text-gray-400 dark:text-white/50">
              Loading your posts…
            </p>
          ) : vendorPosts.length === 0 ? (
            <p className="py-8 text-center text-[0.85rem] text-gray-400 dark:text-white/50">
              No posts yet. Share your first one.
            </p>
          ) : (
            <div className="space-y-2">
              {vendorPosts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-3.5 dark:bg-black/25"
                >
                  <p className="line-clamp-2 text-[0.88rem] text-gray-900 dark:text-white">
                    {p.post_text}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEditPost(p)}
                      className="text-[0.78rem] font-semibold text-red-600 dark:text-red-400"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleVendorPostDelete(p.id)}
                      className="text-[0.78rem] font-semibold text-gray-500 dark:text-white/50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======== STEP: CREATE / EDIT EVENT (venue owner — acting_as: "venue") ======== */}
      {step === "create-event" && (
        <form onSubmit={(e) => void handleVendorEventSubmit(e)} className="mt-2 space-y-4 pb-28">
          <VendorInput
            label="Event title *"
            value={evTitle}
            placeholder="e.g. Live Music Friday"
            maxLength={100}
            error={evFieldErrors.title}
            onChange={setEvTitle}
          />

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
              Category *
            </label>
            <select
              value={evCategory}
              onChange={(e) => setEvCategory(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:focus:border-[#ff6a6a]"
            >
              <option value="">Select a category…</option>
              {EVENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {evFieldErrors.category ? (
              <p className="mt-1.5 text-[0.78rem] text-red-500">{evFieldErrors.category}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
              Description
            </label>
            <textarea
              value={evDescription}
              onChange={(e) => setEvDescription(e.target.value)}
              placeholder="Describe your event…"
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <VendorInput label="Date *" type="date" value={evDate} placeholder="" error={evFieldErrors.date} onChange={setEvDate} />
            <VendorInput label="Start time *" type="time" value={evStartTime} placeholder="" error={evFieldErrors.startTime} onChange={setEvStartTime} />
          </div>

          <VendorInput label="End time" type="time" value={evEndTime} placeholder="" error={evFieldErrors.endTime} onChange={setEvEndTime} />

          <VendorInput
            label="Ticket / RSVP link"
            type="url"
            value={evTicketUrl}
            placeholder="https://…"
            onChange={setEvTicketUrl}
          />

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
              Photos
            </label>
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
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
              Videos
            </label>
            <VideoUploader
              value={evVideos}
              onChange={setEvVideos}
              folder="events"
              max={Math.max(0, 5 - evImageUrls.length)}
              onUploadingChange={setEvVideoUploading}
            />
          </div>

          {evError ? <p className="text-sm text-red-500">{evError}</p> : null}

          <ActionButton
            type="submit"
            className="w-full"
            disabled={evBusy || evUploading || evVideoUploading}
          >
            {evUploading || evVideoUploading
              ? "Uploading…"
              : evBusy
                ? "Saving…"
                : editingEventId.current
                  ? "Save changes"
                  : "Create event"}
          </ActionButton>
        </form>
      )}

      {/* ======== STEP: CREATE / EDIT POST (venue owner — acting_as: "venue") ======== */}
      {step === "create-post" && (
        <form onSubmit={(e) => void handleVendorPostSubmit(e)} className="mt-2 space-y-4 pb-28">
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder="What's happening at your venue?"
            rows={6}
            maxLength={POST_TEXT_MAX}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
            autoFocus
          />
          {postError ? <p className="text-sm text-red-500">{postError}</p> : null}

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

          {postShowImageInput || postVideos.length > 0 ? (
            <VideoUploader
              value={postVideos}
              onChange={setPostVideos}
              folder="posts"
              max={Math.max(0, 5 - postImageUrls.length)}
              onUploadingChange={setPostVideoUploading}
            />
          ) : null}

          <button
            type="button"
            onClick={() => setPostShowImageInput((v) => !v)}
            className="text-[0.82rem] font-semibold text-red-600 dark:text-red-400"
          >
            {postShowImageInput ? "Hide photo/video" : "+ Add photo or video"}
          </button>

          <ActionButton
            type="submit"
            className="w-full"
            disabled={postBusy || postUploading || postVideoUploading || !postText.trim()}
          >
            {postUploading || postVideoUploading
              ? "Uploading…"
              : postBusy
                ? "Saving…"
                : editingPostId.current
                  ? "Save changes"
                  : "Post It"}
          </ActionButton>
        </form>
      )}

      {/* ======== STEP: BOOST ======== */}
      {step === "boost" && (() => {
        // `id` is the Stripe tier code Xano's checkout_vendor_plan expects as
        // `boost_tier` — it must stay in sync with the stripe_price_boost_* env vars.
        const tiers = [
          { id: "1999", label: "3-Day Boost",   price: "$19.99", desc: "Quick visibility spike for a weekend or event" },
          { id: "3999", label: "7-Day Boost",   price: "$39.99", desc: "Week-long push — great for new menu launches" },
          { id: "5999", label: "14-Day Boost",  price: "$59.99", desc: "Two-week momentum for sustained discovery" },
          { id: "7999", label: "Monthly Boost", price: "$79.99", desc: "30 days of top placement in Genie results" },
        ];
        return (
          <div className="mt-2 space-y-4 pb-28">
            <p className="text-[0.9rem] text-gray-500 dark:text-white/60">
              Boost puts your listing at the top of Genie results for your area. Pick a duration:
            </p>
            <div className="space-y-3">
              {tiers.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedBoostTier(tier.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedBoostTier === tier.id
                      ? "border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-900/20"
                      : "border-[#E7070380] bg-white/5 dark:bg-black/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[0.95rem] font-semibold text-gray-900 dark:text-white">{tier.label}</p>
                    <p className="text-[1.1rem] font-bold text-red-600 dark:text-[#ff7b7b]">{tier.price}</p>
                  </div>
                  <p className="mt-1 text-[0.8rem] text-gray-500 dark:text-white/55">{tier.desc}</p>
                </button>
              ))}
            </div>
            <ActionButton
              onClick={() => {
                if (!selectedBoostTier) { setStatusMessage("Please select a boost duration."); return; }
                setIsBoostLoading(true);
                const vid = vendorId ?? dashboardData?.vendor_id;
                if (!vid) { setStatusMessage("Vendor not found. Please try again."); setIsBoostLoading(false); return; }
                void createSubscriptionCheckout({ vendor_id: vid, plan_type: "boost", boost_tier: selectedBoostTier })
                  .then(({ checkout_url }) => { window.location.href = checkout_url; })
                  .catch((err) => { setStatusMessage(err instanceof Error ? err.message : "Could not start checkout."); })
                  .finally(() => setIsBoostLoading(false));
              }}
              disabled={isBoostLoading || !selectedBoostTier}
              className="w-full"
            >
              {isBoostLoading ? "Redirecting to Stripe..." : "Purchase Boost"}
            </ActionButton>
            <p className="text-center text-[0.75rem] text-gray-400 dark:text-white/40">
              You&apos;ll be taken to Stripe to complete your purchase securely.
            </p>
          </div>
        );
      })()}

      {/* ======== STEP: INFLUENCER CODES ======== */}
      {step === "influencer-codes" && (() => {
        const codes = influencerCodes;
        const selected = codes.find((c) => c.code === selectedInfluencerCode) ?? null;
        return (
          <div className="mt-2 space-y-4 pb-28">
            <p className="text-[0.82rem] text-gray-400 dark:text-white/50">
              Influencer codes driving traffic to your listing. Tap a code to see redemption history.
            </p>

            {influencerLoading && (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
              </div>
            )}

            {/* Code list */}
            {!influencerLoading && !selected && (
              <>
                {codes.length === 0 ? (
                  <p className="text-center text-[0.88rem] text-gray-400 dark:text-white/50 py-6">
                    No influencer codes yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {codes.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setSelectedInfluencerCode(c.code)}
                        className="w-full rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 text-left transition hover:bg-white/10 dark:bg-black/20 dark:hover:bg-black/30"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[0.95rem] font-semibold text-gray-900 dark:text-white font-mono">{c.code}</p>
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6"/></svg>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[1rem] font-bold text-gray-900 dark:text-white">{c.redeemed}</p>
                            <p className="text-[0.68rem] text-gray-400 dark:text-white/50">Redeemed</p>
                          </div>
                          <div>
                            <p className="text-[1rem] font-bold text-gray-900 dark:text-white">{c.new_users}</p>
                            <p className="text-[0.68rem] text-gray-400 dark:text-white/50">New Users</p>
                          </div>
                          <div>
                            <p className="text-[1rem] font-bold text-gray-900 dark:text-white">{c.vibee_conversions}</p>
                            <p className="text-[0.68rem] text-gray-400 dark:text-white/50">V.I.Bee Conv.</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Detail view */}
            {selected && (
              <div className="space-y-4">
                <button type="button" onClick={() => setSelectedInfluencerCode(null)} className="flex items-center gap-1.5 text-[0.85rem] text-red-500">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H6m0 0 5-5m-5 5 5 5"/></svg>
                  All Codes
                </button>
                <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 dark:bg-black/20">
                  <p className="text-[1.1rem] font-bold font-mono text-gray-900 dark:text-white">{selected.code}</p>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    {[{ label: "Redeemed", val: selected.redeemed },{ label: "New Users", val: selected.new_users },{ label: "V.I.Bee", val: selected.vibee_conversions }].map(({ label, val }) => (
                      <div key={label} className="rounded-xl border border-[#E7070380] py-3 dark:border-[#E7070380]">
                        <p className="text-[1.2rem] font-bold text-gray-900 dark:text-white">{val}</p>
                        <p className="text-[0.68rem] text-gray-400 dark:text-white/50">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {(selected.history ?? []).length > 0 && (
                  <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 dark:bg-black/20">
                    <p className="mb-3 text-[0.82rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/55">Redemption History</p>
                    <div className="space-y-2">
                      {(selected.history ?? []).map((date, i) => (
                        <div key={i} className="flex items-center justify-between border-t border-red-100/30 pt-2 dark:border-white/10">
                          <p className="text-[0.85rem] text-gray-700 dark:text-white/80">Redemption #{selected.redeemed - i}</p>
                          <p className="text-[0.8rem] text-gray-400 dark:text-white/50">{date}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ======== STEP: SETTINGS ======== */}
      {step === "settings" && (
        <div className="mt-2 space-y-5 pb-28">
          {/* Plan info */}
          <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 dark:bg-black/20">
            <p className="text-[0.82rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/55">Current Plan</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[1rem] font-semibold text-gray-900 dark:text-white capitalize">
                {dashboardData?.plan_selected ?? "Basic"}
              </p>
              <span className={`rounded-full px-3 py-1 text-[0.75rem] font-bold ${
                dashboardData?.is_pro
                  ? "bg-red-600 text-white"
                  : "bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-white/60"
              }`}>
                {dashboardData?.is_pro ? "PRO" : "FREE"}
              </span>
            </div>
            {!dashboardData?.is_pro && (
              <button type="button" onClick={() => setStep("boost")} className="mt-3 text-[0.82rem] font-medium text-red-500 hover:underline">
                Upgrade to Pro →
              </button>
            )}
          </div>

          {/* Notifications */}
          <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 dark:bg-black/20 space-y-4">
            <p className="text-[0.82rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/55">Notifications</p>
            {([
              { key: "emailNotif", label: "Email notifications" },
              { key: "pushNotif",  label: "Push notifications" },
              { key: "smsNotif",   label: "SMS notifications" },
            ] as const).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <p className="text-[0.9rem] text-gray-700 dark:text-white/80">{label}</p>
                <button
                  type="button"
                  onClick={() => setSettingsForm((c) => ({ ...c, [key]: !c[key] }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${settingsForm[key] ? "bg-red-600" : "bg-gray-300 dark:bg-white/20"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settingsForm[key] ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
            <VendorInput
              value={settingsForm.smsPhone}
              placeholder="SMS phone number"
              type="tel"
              onChange={(v) => setSettingsForm((c) => ({ ...c, smsPhone: v }))}
              label="SMS Number"
            />
          </div>

          {/* Account info */}
          <div className="rounded-2xl border border-[#E7070380] bg-white/5 px-4 py-4 dark:bg-black/20 space-y-3">
            <p className="text-[0.82rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/55">Account</p>
            <DetailRow label="Email" value={dashboardData?.email ?? account?.email} />
            <DetailRow label="Business" value={dashboardData?.business_name} withDivider />
          </div>

          {settingsMessage && (
            <p className={`text-sm ${settingsMessage.includes("saved") ? "text-green-500" : "text-red-500"}`}>{settingsMessage}</p>
          )}

          <ActionButton
            onClick={() => {
              const extId = readExternalUserId();
              if (!extId) { setSettingsMessage("Account not found. Please log in again."); return; }
              setIsSavingSettings(true);
              setSettingsMessage(null);
              updateVendorNotifPrefs({
                external_user_id: extId,
                email_notifications: settingsForm.emailNotif,
                push_notifications: settingsForm.pushNotif,
                sms_notifications: settingsForm.smsNotif,
                sms_phone: settingsForm.smsPhone || undefined,
              })
                .then(() => setSettingsMessage("Settings saved successfully!"))
                .catch((err) => setSettingsMessage(err instanceof Error ? err.message : "Could not save settings."))
                .finally(() => setIsSavingSettings(false));
            }}
            disabled={isSavingSettings}
            className="w-full"
          >
            {isSavingSettings ? "Saving..." : "Save Settings"}
          </ActionButton>

          <ActionButton
            variant="secondary"
            onClick={onContinueHome}
            className="w-full"
          >
            Back to Home
          </ActionButton>
        </div>
      )}

      {statusMessage && (
        <div className="mt-5 rounded-2xl border border-[#E7070380] bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-[#E7070380] dark:bg-black/20 dark:text-white/60">
          {statusMessage}
        </div>
      )}
    </section>
  );
}
