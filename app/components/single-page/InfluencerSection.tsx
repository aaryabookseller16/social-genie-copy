"use client";

import Image from "next/image";
import React, { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { ActionButton } from "@/app/components/single-page/ui";
import { type FlowAnchor } from "@/app/components/single-page/ui";
import { type ConsumerAccount } from "@/app/lib/localState";
import ImageUploader from "@/app/components/ImageUploader";
import ImageLightbox from "@/app/components/ImageLightbox";
import VideoUploader, { type VideoSlotValue } from "@/app/components/VideoUploader";
import ImageGallery from "@/app/components/ImageGallery";
import FeaturedEventVideos from "@/app/components/FeaturedEventVideos";
import { galleryFor } from "@/app/lib/image";
import {
  createInfluencerOffer,
  createInfluencerProfile,
  fetchInfluencerDashboard,
  fetchInfluencerOfferAnalytics,
  fetchMyInfluencerProfile,
  searchPublicEvents,
  searchVendorBusinesses,
  type InfluencerDashboardData,
  type InfluencerOffer,
  type InfluencerOfferAnalytics,
  type MyInfluencerProfile,
  type VideoItem,
} from "@/app/lib/publicApiClient";

// ─── Types ───────────────────────────────────────────────────────────────────

type View =
  | "loading"
  | "onboarding"
  | "dashboard"
  | "offers"
  | "create-offer"
  | "offer-detail"
  | "profile-edit"
  | "settings"
  | "earnings"
  | "partnerships";

type OfferFilter = "active" | "pending" | "rejected" | "cancelled";

const OFFER_TYPES = [
  { value: "happy_hour", label: "Happy Hour" },
  { value: "bogo", label: "BOGO" },
  { value: "discount", label: "Discount" },
  { value: "freebie", label: "Freebie" },
  { value: "special_event", label: "Special Event" },
] as const;

const NICHES = [
  { value: "food", label: "Food & Dining" },
  { value: "nightlife", label: "Nightlife" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "travel", label: "Travel" },
  { value: "fitness", label: "Fitness" },
  { value: "general", label: "Social Experiences" },
] as const;

const inputClass =
  "w-full rounded-2xl border border-gray-300 bg-transparent px-4 py-3.5 text-[16px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none dark:border-white/20 dark:text-white dark:placeholder:text-white/35 dark:focus:border-red-400";

const selectClass =
  "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-[16px] text-gray-900 focus:border-red-500 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-white dark:focus:border-red-400";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  account: ConsumerAccount | null;
  onNavigate: (anchor: FlowAnchor) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNicheLabel(niche?: string) {
  return NICHES.find((n) => n.value === niche)?.label ?? niche ?? "";
}

function formatOfferType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDiscount(value?: number | string, type?: string) {
  if (!value) return null;
  return type === "percent" ? `${value}%` : `$${value}`;
}

function normalizeStatus(status?: string): OfferFilter {
  const s = (status ?? "").toLowerCase();
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "rejected" || s === "declined") return "rejected";
  if (s === "pending" || s === "pending_review" || s === "in_review")
    return "pending";
  return "active";
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const kind = normalizeStatus(status);
  const styles: Record<OfferFilter, string> = {
    active:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300",
    pending:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    rejected:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
    cancelled:
      "border-gray-200 bg-gray-100 text-gray-600 dark:border-white/15 dark:bg-white/10 dark:text-white/60",
  };
  const labels: Record<OfferFilter, string> = {
    active: "Active",
    pending: "Pending",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.68rem] font-semibold ${styles[kind]}`}
    >
      {labels[kind]}
    </span>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string | undefined;
}) {
  return (
    <div className="flex-1 rounded-[18px] border border-gray-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm">
      <p className="text-[1.6rem] font-black leading-none text-gray-900 dark:text-white">
        {value ?? "—"}
      </p>
      <p className="mt-1 text-[0.7rem] font-medium uppercase tracking-wide text-gray-500 dark:text-white/50">
        {label}
      </p>
    </div>
  );
}

// ─── Nav Tile ────────────────────────────────────────────────────────────────

function NavTile({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-[18px] border border-gray-100 bg-white/90 py-3.5 px-2 shadow-sm transition active:opacity-75 dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm"
    >
      <span className="text-red-500 dark:text-[#ff7b7b]">{icon}</span>
      <span className="text-[0.68rem] font-semibold text-gray-600 dark:text-white/70">
        {label}
      </span>
    </button>
  );
}

// ─── Offer Row ───────────────────────────────────────────────────────────────

function OfferRow({
  offer,
  onTap,
}: {
  offer: InfluencerOffer;
  onTap: () => void;
}) {
  const discount = formatDiscount(offer.discount_value, offer.discount_type);
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full rounded-[20px] border border-gray-100 bg-white/90 p-4 text-left shadow-sm transition active:opacity-80 dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-block rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[0.68rem] font-semibold text-red-600 dark:border-white/10 dark:bg-black/20 dark:text-white/70">
              {formatOfferType(offer.offer_type)}
            </span>
            <StatusBadge status={offer.status} />
          </div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {offer.offer_title}
          </p>
          {offer.promo_code ? (
            <p className="mt-1 text-[0.75rem] font-bold uppercase tracking-wider text-red-600 dark:text-[#ff7b7b]">
              {offer.promo_code}
            </p>
          ) : null}
        </div>
        <div className="flex-none text-right">
          {discount ? (
            <>
              <p className="text-[1.3rem] font-black leading-none text-red-600 dark:text-[#ff7b7b]">
                {discount}
              </p>
              <p className="text-[0.62rem] text-gray-400 dark:text-white/40">OFF</p>
            </>
          ) : null}
          <svg
            viewBox="0 0 24 24"
            className="ml-auto mt-1 h-4 w-4 text-gray-400 dark:text-white/30"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
      {((offer.redemptions_used ?? offer.redemption_count) ?? 0) > 0 ? (
        <p className="mt-2 text-[0.72rem] text-gray-400 dark:text-white/40">
          {offer.redemptions_used ?? offer.redemption_count} redemptions
        </p>
      ) : null}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

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

export function InfluencerSection({ account, onNavigate }: Props) {
  const [view, setView] = useState<View>("loading");
  const [profile, setProfile] = useState<MyInfluencerProfile | null>(null);
  const [dashboard, setDashboard] = useState<InfluencerDashboardData | null>(null);
  const [offers, setOffers] = useState<InfluencerOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<InfluencerOffer | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Onboarding / profile-edit form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [contentNiche, setContentNiche] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Offers list filter (Active / Pending / Rejected)
  const [offerFilter, setOfferFilter] = useState<OfferFilter>("active");

  // Create-offer form state
  const [offerTarget, setOfferTarget] = useState<"venue" | "event">("venue");
  const [venueQuery, setVenueQuery] = useState("");
  const [venueResults, setVenueResults] = useState<
    { id: number; name: string }[]
  >([]);
  const [isSearchingVenues, setIsSearchingVenues] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [eventQuery, setEventQuery] = useState("");
  const [eventResults, setEventResults] = useState<
    { id: number; name: string; event_date?: string }[]
  >([]);
  const [isSearchingEvents, setIsSearchingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<{
    id: number;
    name: string;
    event_date?: string;
  } | null>(null);
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [offerType, setOfferType] = useState<string>("discount");
  const [discountValue, setDiscountValue] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [offerImageUrls, setOfferImageUrls] = useState<string[]>([]);
  const [offerVideos, setOfferVideos] = useState<VideoSlotValue[]>([]);
  const [offerImageUploading, setOfferImageUploading] = useState(false);
  const [offerVideoUploading, setOfferVideoUploading] = useState(false);

  // Offer-detail analytics
  const [offerAnalytics, setOfferAnalytics] =
    useState<InfluencerOfferAnalytics | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-dismiss the transient status/toast message after a few seconds.
  useAutoClear(message, setMessage);

  const didCheckRef = useRef(false);

  // ── Gate check ────────────────────────────────────────────────────────────

  const checkProfile = useCallback(async () => {
    try {
      const p = await fetchMyInfluencerProfile();
      if (p?.display_name) {
        setProfile(p);
        setView("dashboard");
        // Kick off dashboard fetch in background
        fetchInfluencerDashboard()
          .then((d) => setDashboard(d))
          .catch(() => {});
      } else {
        setView("onboarding");
      }
    } catch {
      // 404 or any error → show onboarding
      setView("onboarding");
    }
  }, []);

  useEffect(() => {
    if (!account) return;
    if (didCheckRef.current) return;
    didCheckRef.current = true;
    checkProfile();
  }, [account, checkProfile]);

  // ── Dashboard ─────────────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    try {
      const d = await fetchInfluencerDashboard();
      setDashboard(d);
    } catch {
      // silently ignore — dashboard is read-only enhancement
    }
  }, []);

  // ── Offers list ───────────────────────────────────────────────────────────

  // Offers list is sourced from the dashboard (all statuses) so pending and
  // rejected offers are visible under their tabs — the public offers endpoint
  // only returns active offers.
  const openOffers = useCallback(async () => {
    setView("offers");
    setIsLoadingOffers(true);
    try {
      const d = await fetchInfluencerDashboard();
      setDashboard(d);
      setOffers(d.offers ?? []);
    } catch {
      // keep whatever we already have
    } finally {
      setIsLoadingOffers(false);
    }
  }, []);

  // ── Create offer ──────────────────────────────────────────────────────────

  const openCreateOffer = useCallback(() => {
    setOfferTarget("venue");
    setVenueQuery("");
    setVenueResults([]);
    setSelectedVenue(null);
    setEventQuery("");
    setEventResults([]);
    setSelectedEvent(null);
    setOfferTitle("");
    setOfferDescription("");
    setOfferType("discount");
    setDiscountValue("");
    setPromoCode("");
    setMaxRedemptions("");
    setExpiresAt("");
    setOfferImageUrls([]);
    setOfferVideos([]);
    setMessage(null);
    setView("create-offer");
  }, []);

  const searchVenues = useCallback(async () => {
    const q = venueQuery.trim();
    if (q.length < 2) {
      setMessage("Type at least 2 characters to search venues.");
      return;
    }
    setIsSearchingVenues(true);
    setMessage(null);
    try {
      const results = await searchVendorBusinesses(q);
      setVenueResults(
        results
          .filter((v) => v.id != null)
          .map((v) => ({ id: Number(v.id), name: v.venue_name }))
      );
    } catch {
      setVenueResults([]);
      setMessage("Could not search venues. Please try again.");
    } finally {
      setIsSearchingVenues(false);
    }
  }, [venueQuery]);

  const searchEvents = useCallback(async () => {
    const q = eventQuery.trim();
    if (q.length < 2) {
      setMessage("Type at least 2 characters to search events.");
      return;
    }
    setIsSearchingEvents(true);
    setMessage(null);
    try {
      const results = await searchPublicEvents(q);
      setEventResults(
        results
          .filter((e) => e.id != null)
          .map((e) => ({
            id: Number(e.id),
            name: e.title,
            event_date: e.event_date,
          }))
      );
    } catch {
      setEventResults([]);
      setMessage("Could not search events. Please try again.");
    } finally {
      setIsSearchingEvents(false);
    }
  }, [eventQuery]);

  const submitOffer = useCallback(async () => {
    if (offerTarget === "venue" ? !selectedVenue : !selectedEvent) {
      setMessage(
        offerTarget === "venue"
          ? "Please pick a venue for this offer."
          : "Please pick an event for this offer."
      );
      return;
    }
    if (!offerTitle.trim()) {
      setMessage("Offer title is required.");
      return;
    }
    if (!offerType) {
      setMessage("Please choose an offer type.");
      return;
    }
    if (offerImageUploading || offerVideoUploading) {
      setMessage("Please wait for your photos and videos to finish uploading.");
      return;
    }
    setIsSavingOffer(true);
    setMessage(null);
    try {
      const discountNum = Number(discountValue);
      const maxNum = Number(maxRedemptions);
      const hasDiscount =
        discountValue.trim() !== "" && Number.isFinite(discountNum);
      const hasMax = maxRedemptions.trim() !== "" && Number.isFinite(maxNum);
      const videoUrls: VideoItem[] = offerVideos.map((v) => ({
        url: v.url,
        thumbnail_url: v.thumbnailUrl,
      }));
      const created = await createInfluencerOffer({
        venue_id: offerTarget === "venue" ? selectedVenue!.id : undefined,
        event_id: offerTarget === "event" ? selectedEvent!.id : undefined,
        offer_title: offerTitle.trim(),
        offer_type: offerType,
        offer_description: offerDescription.trim() || undefined,
        discount_value: hasDiscount ? discountNum : undefined,
        promo_code: promoCode.trim() || undefined,
        max_redemptions: hasMax ? maxNum : undefined,
        expires_at: expiresAt.trim() || undefined,
        image_urls: offerImageUrls.length > 0 ? offerImageUrls : undefined,
        video_urls: videoUrls.length > 0 ? videoUrls : undefined,
      });

      // Insert a local copy immediately so it shows up without a refresh.
      const newOffer: InfluencerOffer = {
        id: created.offer_id ?? Date.now(),
        venue_id: offerTarget === "venue" ? selectedVenue!.id : undefined,
        event_id: offerTarget === "event" ? selectedEvent!.id : undefined,
        event_title: offerTarget === "event" ? selectedEvent!.name : undefined,
        event_date:
          offerTarget === "event" ? selectedEvent!.event_date : undefined,
        offer_title: created.offer_title ?? offerTitle.trim(),
        offer_type: created.offer_type ?? offerType,
        offer_description: offerDescription.trim() || undefined,
        discount_value: hasDiscount ? discountNum : undefined,
        promo_code: created.promo_code ?? (promoCode.trim() || undefined),
        unique_code: created.promo_code ?? (promoCode.trim() || undefined),
        max_redemptions: hasMax ? maxNum : undefined,
        redemption_count: 0,
        expires_at: expiresAt.trim() || undefined,
        status: created.status ?? "pending",
        image_urls: offerImageUrls.length > 0 ? offerImageUrls : undefined,
        video_urls: videoUrls.length > 0 ? videoUrls : undefined,
      };
      setOffers((prev) => [newOffer, ...prev]);
      setOfferFilter("pending");
      setMessage(
        offerTarget === "venue"
          ? "Submitted — pending venue approval."
          : "Submitted — pending event owner approval."
      );
      setView("offers");

      // Reconcile with the server in the background (no spinner) so the row
      // picks up canonical fields once it's indexed.
      void fetchInfluencerDashboard()
        .then((d) => {
          setDashboard(d);
          if (d.offers) setOffers(d.offers);
        })
        .catch(() => {
          /* keep the optimistic copy */
        });
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not create offer. Please try again."
      );
    } finally {
      setIsSavingOffer(false);
    }
  }, [
    offerTarget,
    selectedVenue,
    selectedEvent,
    offerTitle,
    offerType,
    offerDescription,
    discountValue,
    promoCode,
    maxRedemptions,
    expiresAt,
    offerImageUrls,
    offerVideos,
    offerImageUploading,
    offerVideoUploading,
  ]);

  // ── Offer detail ──────────────────────────────────────────────────────────

  const openOfferDetail = useCallback((offer: InfluencerOffer) => {
    setSelectedOffer(offer);
    setCopied(false);
    setView("offer-detail");
    setOfferAnalytics(null);
    setIsLoadingAnalytics(true);
    fetchInfluencerOfferAnalytics()
      .then((res) => {
        const match = (res.offers ?? []).find((o) => o.id === offer.id) ?? null;
        setOfferAnalytics(match);
      })
      .catch(() => setOfferAnalytics(null))
      .finally(() => setIsLoadingAnalytics(false));
  }, []);

  // ── Onboarding submit ─────────────────────────────────────────────────────

  const submitOnboarding = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!displayName.trim()) {
        setMessage("Display name is required.");
        return;
      }
      setIsSubmitting(true);
      setMessage(null);
      try {
        const created = await createInfluencerProfile({
          display_name: displayName.trim(),
          bio: bio.trim() || undefined,
          instagram_handle: instagramHandle.trim() || undefined,
          tiktok_handle: tiktokHandle.trim() || undefined,
          content_niche: contentNiche || undefined,
        });
        setProfile(created);
        setView("dashboard");
        loadDashboard();
      } catch (err) {
        setMessage(
          err instanceof Error ? err.message : "Could not create profile. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [displayName, bio, instagramHandle, tiktokHandle, contentNiche, loadDashboard]
  );

  // ── Profile edit ──────────────────────────────────────────────────────────

  const openProfileEdit = useCallback(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setInstagramHandle(profile.instagram_handle ?? "");
      setTiktokHandle(profile.tiktok_handle ?? "");
      setContentNiche(profile.content_niche ?? "");
    }
    setMessage(null);
    setView("profile-edit");
  }, [profile]);

  const openSettings = useCallback(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setInstagramHandle(profile.instagram_handle ?? "");
      setTiktokHandle(profile.tiktok_handle ?? "");
      setContentNiche(profile.content_niche ?? "");
    }
    setMessage(null);
    setView("settings");
  }, [profile]);

  const submitProfileEdit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!displayName.trim()) {
        setMessage("Display name is required.");
        return;
      }
      setIsSubmitting(true);
      setMessage(null);
      try {
        const updated = await createInfluencerProfile({
          display_name: displayName.trim(),
          bio: bio.trim() || undefined,
          instagram_handle: instagramHandle.trim() || undefined,
          tiktok_handle: tiktokHandle.trim() || undefined,
          content_niche: contentNiche || undefined,
        });
        setProfile(updated);
        setView("dashboard");
      } catch (err) {
        setMessage(
          err instanceof Error ? err.message : "Could not save profile. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [displayName, bio, instagramHandle, tiktokHandle, contentNiche]
  );

  // ─── No account ───────────────────────────────────────────────────────────

  if (!account) {
    return (
      <section className="relative min-h-screen overflow-hidden px-5 pb-32 pt-14">
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
            Sign in to access your Influencer Dashboard
          </h2>
          <p className="mt-3 text-center text-[15px] leading-relaxed text-gray-500 dark:text-white/60">
            Create an account to get your own offer codes and start growing your audience.
          </p>
          <div className="mt-8 w-full space-y-3">
            <ActionButton
              onClick={() => onNavigate("account")}
              className="w-full"
            >
              Create Account to Get Started
            </ActionButton>
            <ActionButton
              onClick={() => onNavigate("home")}
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

  // ─── Loading gate ─────────────────────────────────────────────────────────

  if (view === "loading") {
    return (
      <section className="space-y-5 pb-28">
        <div className="flex items-center justify-between pt-1">
          <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Influencer Dashboard
          </h1>
        </div>
        <div className="flex min-h-[12rem] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-red-600" />
        </div>
      </section>
    );
  }

  // ─── Onboarding form ──────────────────────────────────────────────────────

  if (view === "onboarding") {
    return (
      <section className="space-y-5 pb-28">
        <div className="pt-1">
          <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Set Up Your Profile
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/60">
            Create your influencer profile to get offer codes and track your audience.
          </p>
        </div>

        <form onSubmit={submitOnboarding} className="space-y-4">
          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-red-600 dark:text-[#ff7b7b]">
              Your public name
            </p>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name (required)"
              className={inputClass}
              style={{ fontSize: "16px" }}
              required
              autoComplete="off"
            />
          </div>

          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-white/60">
              Bio
            </p>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell venues and fans a bit about you (optional)"
              rows={3}
              className={`${inputClass} resize-none`}
              style={{ fontSize: "16px" }}
            />
          </div>

          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-white/60">
              Social handles
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="Instagram handle (optional)"
                className={inputClass}
                style={{ fontSize: "16px" }}
                autoComplete="off"
              />
              <input
                type="text"
                value={tiktokHandle}
                onChange={(e) => setTiktokHandle(e.target.value)}
                placeholder="TikTok handle (optional)"
                className={inputClass}
                style={{ fontSize: "16px" }}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-white/60">
              Content niche
            </p>
            <select
              value={contentNiche}
              onChange={(e) => setContentNiche(e.target.value)}
              className={selectClass}
              style={{ fontSize: "16px" }}
            >
              <option value="">Select a niche (optional)</option>
              {NICHES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>

          {message ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
              {message}
            </div>
          ) : null}

          <ActionButton
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Creating profile…" : "Create My Profile"}
          </ActionButton>
        </form>
      </section>
    );
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  if (view === "dashboard") {
    const firstName = profile?.display_name?.split(" ")[0] ?? "You";
    const dashOffers =
      dashboard?.offers ?? [];

    return (
      <section className="space-y-5 pb-28">
        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
              Influencer Dashboard
            </h1>
            {profile?.handle ? (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-white/50">
                @{profile.handle}
              </p>
            ) : null}
          </div>
        </div>

        {/* Profile card */}
        <div className="rounded-[22px] border border-gray-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {profile?.profile_image_url ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label="View profile photo"
                className="relative h-14 w-14 flex-none cursor-pointer overflow-hidden rounded-full border-2 border-red-400 shadow-[0_0_12px_rgba(220,38,38,0.3)]"
              >
                <Image
                  src={profile.profile_image_url}
                  alt={profile.display_name ?? ""}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </button>
            ) : (
              <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full border-2 border-red-400 bg-red-600 text-xl font-bold text-white shadow-[0_0_12px_rgba(220,38,38,0.3)]">
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
            {lightboxOpen && profile?.profile_image_url ? (
              <ImageLightbox
                src={profile.profile_image_url}
                alt={profile.display_name ?? ""}
                onClose={() => setLightboxOpen(false)}
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-semibold text-gray-900 dark:text-white">
                  {profile?.display_name}
                </p>
                {profile?.is_verified ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 flex-none text-red-500"
                    fill="currentColor"
                  >
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  </svg>
                ) : null}
              </div>
              {profile?.content_niche ? (
                <p className="text-[0.75rem] font-medium text-red-500 dark:text-[#ff7b7b]">
                  {getNicheLabel(profile.content_niche)}
                </p>
              ) : null}
              {profile?.bio ? (
                <p className="mt-0.5 line-clamp-2 text-[0.78rem] text-gray-500 dark:text-white/55">
                  {profile.bio}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Stats */}
        {dashboard ? (
          <div>
            <p className="mb-2 px-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
              Your Stats
            </p>
            <div className="flex gap-3">
              <StatCard
                label="Active Codes"
                value={dashboard.active_codes_count}
              />
              <StatCard
                label="Redemptions"
                value={dashboard.total_redemptions}
              />
            </div>
            {(dashboard.referral_signups !== undefined ||
              dashboard.total_commission_earned !== undefined) ? (
              <div className="mt-3 flex gap-3">
                {dashboard.referral_signups !== undefined ? (
                  <StatCard
                    label="Referrals"
                    value={dashboard.referral_signups}
                  />
                ) : null}
                {dashboard.total_commission_earned !== undefined ? (
                  <StatCard
                    label="Commission Earned"
                    value={`$${dashboard.total_commission_earned}`}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Quick nav */}
        <div className="grid grid-cols-3 gap-3">
          <NavTile
            label="Settings"
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            }
            onClick={openSettings}
          />
          <NavTile
            label="Earnings"
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
            onClick={() => setView("earnings")}
          />
          <NavTile
            label="Partnerships"
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            onClick={() => setView("partnerships")}
          />
        </div>

        {/* Offer codes */}
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
              Your Offer Codes
            </p>
            <div className="flex items-center gap-3">
              {dashOffers.length > 0 ? (
                <button
                  type="button"
                  onClick={openOffers}
                  className="text-[0.72rem] font-medium text-gray-500 underline dark:text-white/50"
                >
                  View all
                </button>
              ) : null}
              <button
                type="button"
                onClick={openCreateOffer}
                className="text-[0.72rem] font-semibold text-red-600 dark:text-[#ff7b7b]"
              >
                + Create Offer
              </button>
            </div>
          </div>

          {dashOffers.length > 0 ? (
            <div className="space-y-3">
              {dashOffers.slice(0, 3).map((offer) => (
                <OfferRow
                  key={offer.id}
                  offer={offer}
                  onTap={() => openOfferDetail(offer)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-gray-200 bg-transparent p-6 text-center dark:border-white/10">
              <p className="text-sm text-gray-500 dark:text-white/50">
                No offer codes yet — create your first offer and tie it to a venue.
              </p>
              <button
                type="button"
                onClick={openCreateOffer}
                className="mt-3 text-sm font-semibold text-red-600 dark:text-[#ff7b7b]"
              >
                + Create Offer
              </button>
            </div>
          )}
        </div>

        {/* Public page link */}
        {profile?.handle ? (
          <div className="rounded-[20px] border border-gray-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/50">
              Your public page
            </p>
            <p className="mt-1 text-sm text-gray-700 dark:text-white/80">
              socialbevy.com/i/{profile.handle}
            </p>
          </div>
        ) : null}
      </section>
    );
  }

  // ─── Offer list ───────────────────────────────────────────────────────────

  if (view === "offers") {
    return (
      <section className="space-y-5 pb-28">
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center text-gray-600 dark:text-white/82"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
            </svg>
          </button>
          <h1 className="flex-1 font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Offer Codes
          </h1>
          <button
            type="button"
            onClick={openCreateOffer}
            className="flex-none rounded-full border border-red-500 bg-red-600 px-3.5 py-1.5 text-[0.78rem] font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
          >
            + Create
          </button>
        </div>

        {message ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
            {message}
          </div>
        ) : null}

        {/* Status tabs with a sliding red indicator */}
        <div className="relative flex rounded-full border border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-black/20">
          {/* sliding pill — moves to the active tab */}
          <span
            aria-hidden
            className="absolute top-1 bottom-1 rounded-full bg-red-600 shadow-sm transition-transform duration-300 ease-out dark:bg-[#b22]"
            style={{
              width: "calc((100% - 0.5rem) / 4)",
              left: "0.25rem",
              transform: `translateX(${
                (["active", "pending", "rejected", "cancelled"] as OfferFilter[]).indexOf(
                  offerFilter
                ) * 100
              }%)`,
            }}
          />
          {(["active", "pending", "rejected", "cancelled"] as OfferFilter[]).map((f) => {
            const count = offers.filter(
              (o) => normalizeStatus(o.status) === f
            ).length;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setOfferFilter(f)}
                className={`relative z-10 flex-1 rounded-full px-1 py-1.5 text-[0.72rem] font-semibold capitalize transition-colors duration-300 ${
                  offerFilter === f
                    ? "text-white"
                    : "text-gray-500 dark:text-white/50"
                }`}
              >
                {f}
                {count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>

        {(() => {
          const filtered = offers.filter(
            (o) => normalizeStatus(o.status) === offerFilter
          );
          if (isLoadingOffers) {
            return (
              <div className="flex min-h-[12rem] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-red-600" />
              </div>
            );
          }
          if (filtered.length > 0) {
            return (
              <div className="space-y-3">
                {filtered.map((offer) => (
                  <OfferRow
                    key={offer.id}
                    offer={offer}
                    onTap={() => openOfferDetail(offer)}
                  />
                ))}
              </div>
            );
          }
          return (
            <div className="rounded-[20px] border border-dashed border-gray-200 bg-transparent p-8 text-center dark:border-white/10">
              <p className="text-sm text-gray-500 dark:text-white/50">
                No {offerFilter} offers.
              </p>
              {offerFilter === "active" ? (
                <button
                  type="button"
                  onClick={openCreateOffer}
                  className="mt-3 text-sm font-medium text-red-600 dark:text-[#ff7b7b]"
                >
                  + Create an offer
                </button>
              ) : null}
            </div>
          );
        })()}
      </section>
    );
  }

  // ─── Create offer ─────────────────────────────────────────────────────────

  if (view === "create-offer") {
    return (
      <section className="space-y-5 pb-28">
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center text-gray-600 dark:text-white/82"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
            </svg>
          </button>
          <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Create Offer
          </h1>
        </div>

        {/* Vendor vs Event toggle */}
        <div className="flex rounded-full border border-gray-200 bg-transparent p-1 dark:border-white/10">
          {(["venue", "event"] as const).map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => setOfferTarget(target)}
              className={`flex-1 rounded-full py-2 text-[0.8rem] font-semibold transition ${
                offerTarget === target
                  ? "bg-red-600 text-white"
                  : "text-gray-500 dark:text-white/60"
              }`}
            >
              {target === "venue" ? "Vendor Offer" : "Event Offer"}
            </button>
          ))}
        </div>

        {/* Venue picker */}
        {offerTarget === "venue" ? (
          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-red-600 dark:text-[#ff7b7b]">
              Venue (required)
            </p>
            {selectedVenue ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-white/85">
                  {selectedVenue.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVenue(null);
                    setVenueResults([]);
                    setVenueQuery("");
                  }}
                  className="flex-none text-[0.75rem] font-medium text-red-600 underline dark:text-[#ff7b7b]"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={venueQuery}
                    onChange={(e) => setVenueQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void searchVenues();
                      }
                    }}
                    placeholder="Search venues by name"
                    className={inputClass}
                    style={{ fontSize: "16px" }}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void searchVenues()}
                    disabled={isSearchingVenues}
                    className="flex-none rounded-2xl border border-red-500 bg-red-600 px-4 text-[0.82rem] font-semibold text-white disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                  >
                    {isSearchingVenues ? "…" : "Search"}
                  </button>
                </div>
                {venueResults.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {venueResults.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVenue(v);
                          setVenueResults([]);
                        }}
                        className="w-full rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 text-left text-sm text-gray-800 transition active:opacity-75 dark:border-white/10 dark:bg-black/20 dark:text-white/85"
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-red-600 dark:text-[#ff7b7b]">
              Event (required)
            </p>
            {selectedEvent ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-white/85">
                  {selectedEvent.name}
                  {selectedEvent.event_date ? ` · ${selectedEvent.event_date}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEvent(null);
                    setEventResults([]);
                    setEventQuery("");
                  }}
                  className="flex-none text-[0.75rem] font-medium text-red-600 underline dark:text-[#ff7b7b]"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={eventQuery}
                    onChange={(e) => setEventQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void searchEvents();
                      }
                    }}
                    placeholder="Search events by name"
                    className={inputClass}
                    style={{ fontSize: "16px" }}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void searchEvents()}
                    disabled={isSearchingEvents}
                    className="flex-none rounded-2xl border border-red-500 bg-red-600 px-4 text-[0.82rem] font-semibold text-white disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                  >
                    {isSearchingEvents ? "…" : "Search"}
                  </button>
                </div>
                {eventResults.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {eventResults.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          setSelectedEvent(e);
                          setEventResults([]);
                        }}
                        className="w-full rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 text-left text-sm text-gray-800 transition active:opacity-75 dark:border-white/10 dark:bg-black/20 dark:text-white/85"
                      >
                        {e.name}
                        {e.event_date ? ` · ${e.event_date}` : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}

        {/* Offer fields */}
        <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10 space-y-4">
          <input
            type="text"
            value={offerTitle}
            onChange={(e) => setOfferTitle(e.target.value)}
            placeholder="Offer title (required)"
            className={inputClass}
            style={{ fontSize: "16px" }}
            autoComplete="off"
          />
          <textarea
            value={offerDescription}
            onChange={(e) => setOfferDescription(e.target.value)}
            placeholder="Describe the offer (optional)"
            rows={3}
            className={`${inputClass} resize-none`}
            style={{ fontSize: "16px" }}
          />
          <select
            value={offerType}
            onChange={(e) => setOfferType(e.target.value)}
            className={selectClass}
            style={{ fontSize: "16px" }}
          >
            {OFFER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
              Photos (optional)
            </label>
            <ImageUploader
              mode="multi"
              max={Math.max(0, 5 - offerVideos.length)}
              folder="offers"
              value={offerImageUrls}
              onChange={setOfferImageUrls}
              onUploadingChange={setOfferImageUploading}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
              Videos (optional)
            </label>
            <VideoUploader
              value={offerVideos}
              onChange={setOfferVideos}
              folder="offers"
              max={Math.max(0, 5 - offerImageUrls.length)}
              onUploadingChange={setOfferVideoUploading}
            />
            <p className="mt-1.5 text-[11px] text-gray-400 dark:text-white/40">
              Up to 5 photos and videos combined.
            </p>
          </div>
          <input
            type="number"
            inputMode="decimal"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder="Discount value (optional)"
            className={inputClass}
            style={{ fontSize: "16px" }}
          />
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Promo code (auto-generated if blank)"
            className={inputClass}
            style={{ fontSize: "16px" }}
            autoComplete="off"
          />
          <input
            type="number"
            inputMode="numeric"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Max redemptions (default 100)"
            className={inputClass}
            style={{ fontSize: "16px" }}
          />
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
              Expires at (optional)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={inputClass}
              style={{ fontSize: "16px" }}
            />
          </div>
        </div>

        {message ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
            {message}
          </div>
        ) : null}

        <div className="flex gap-2">
          <ActionButton
            onClick={() => void submitOffer()}
            disabled={isSavingOffer}
            className="flex-1"
          >
            {isSavingOffer ? "Submitting…" : "Create Offer"}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => setView("dashboard")}
            className="flex-1"
          >
            Cancel
          </ActionButton>
        </div>
      </section>
    );
  }

  // ─── Offer detail ─────────────────────────────────────────────────────────

  if (view === "offer-detail" && selectedOffer) {
    const offer = selectedOffer;
    const discount = formatDiscount(offer.discount_value, offer.discount_type);
    const offerImages = galleryFor(offer.image_urls?.[0], offer.image_urls);

    return (
      <section className="space-y-5 pb-28">
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setView("offers")}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center text-gray-600 dark:text-white/82"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
            </svg>
          </button>
          <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Offer Detail
          </h1>
        </div>

        {offerImages.length > 0 ? (
          <div className="-mx-4 overflow-hidden">
            <ImageGallery images={offerImages} alt={offer.offer_title} heightClass="h-56" />
          </div>
        ) : null}

        <div className="rounded-[22px] border border-gray-100 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="inline-block rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[0.68rem] font-semibold text-red-600 dark:border-white/10 dark:bg-black/20 dark:text-white/70">
              {formatOfferType(offer.offer_type)}
            </span>
            <StatusBadge status={offer.status} />
          </div>
          <h2 className="text-[1.15rem] font-bold text-gray-900 dark:text-white">
            {offer.offer_title}
          </h2>
          {offer.offer_description ? (
            <p className="mt-2 text-[0.88rem] leading-6 text-gray-500 dark:text-white/60">
              {offer.offer_description}
            </p>
          ) : null}

          {offer.promo_code ? (
            <div className="mt-4 inline-flex items-center rounded-[12px] border border-dashed border-red-300 bg-red-50 px-4 py-2.5 dark:border-white/20 dark:bg-white/5">
              <span className="text-sm font-bold uppercase tracking-wider text-red-600 dark:text-white/85">
                {offer.promo_code}
              </span>
            </div>
          ) : null}

          {discount ? (
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-[2rem] font-black text-red-600 dark:text-[#ff7b7b]">
                {discount}
              </span>
              <span className="text-sm text-gray-400 dark:text-white/40">off</span>
            </div>
          ) : null}
        </div>

        <FeaturedEventVideos
          videos={offer.video_urls}
          eventTitle={offer.offer_title}
          headingClassName="text-gray-900 dark:text-white"
        />

        {/* Rejection reason */}
        {normalizeStatus(offer.status) === "rejected" && offer.rejection_reason ? (
          <div className="rounded-[20px] border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
            <p className="text-[0.72rem] font-bold uppercase tracking-wide text-red-600 dark:text-red-300">
              Rejected by venue
            </p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-200">
              {offer.rejection_reason}
            </p>
          </div>
        ) : null}

        {/* Share */}
        {profile?.handle ? (
          <div className="rounded-[20px] border border-gray-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/50">
              Share this offer
            </p>
            <div className="mt-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-white/80">
                app.socialbevy.com/i/{profile.handle}
              </p>
              <button
                type="button"
                onClick={() => {
                  const url = `https://app.socialbevy.com/i/${profile.handle}`;
                  navigator.clipboard
                    ?.writeText(url)
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    })
                    .catch(() => {});
                }}
                className="flex-none rounded-full border border-red-500 bg-red-600 px-3.5 py-1.5 text-[0.75rem] font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            {normalizeStatus(offer.status) !== "active" ? (
              <p className="mt-2 text-[0.72rem] text-gray-400 dark:text-white/40">
                Goes live once the venue approves this offer.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Redemption analytics */}
        <div>
          <p className="mb-2 px-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
            Performance
          </p>
          {isLoadingAnalytics ? (
            <div className="flex min-h-[6rem] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-red-600" />
            </div>
          ) : (
            <div className="flex gap-3">
              <StatCard
                label="Redemptions"
                value={
                  offerAnalytics?.total_redemptions ?? offer.redemption_count ?? 0
                }
              />
              <StatCard
                label="New Users"
                value={offerAnalytics?.new_user_count ?? "—"}
              />
              <StatCard
                label="V.I.Bee Conv."
                value={offerAnalytics?.vibbee_conversions ?? "—"}
              />
            </div>
          )}
        </div>
      </section>
    );
  }

  // ─── Profile edit ─────────────────────────────────────────────────────────

  if (view === "profile-edit") {
    return (
      <section className="space-y-5 pb-28">
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center text-gray-600 dark:text-white/82"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
            </svg>
          </button>
          <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Edit Profile
          </h1>
        </div>

        <form onSubmit={submitProfileEdit} className="space-y-4">
          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-red-600 dark:text-[#ff7b7b]">
              Your public name
            </p>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name (required)"
              className={inputClass}
              style={{ fontSize: "16px" }}
              required
              autoComplete="off"
            />
          </div>

          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-white/60">
              Bio
            </p>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell venues and fans a bit about you (optional)"
              rows={3}
              className={`${inputClass} resize-none`}
              style={{ fontSize: "16px" }}
            />
          </div>

          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-white/60">
              Social handles
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="Instagram handle (optional)"
                className={inputClass}
                style={{ fontSize: "16px" }}
                autoComplete="off"
              />
              <input
                type="text"
                value={tiktokHandle}
                onChange={(e) => setTiktokHandle(e.target.value)}
                placeholder="TikTok handle (optional)"
                className={inputClass}
                style={{ fontSize: "16px" }}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-white/60">
              Content niche
            </p>
            <select
              value={contentNiche}
              onChange={(e) => setContentNiche(e.target.value)}
              className={selectClass}
              style={{ fontSize: "16px" }}
            >
              <option value="">Select a niche (optional)</option>
              {NICHES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>

          {message ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
              {message}
            </div>
          ) : null}

          <ActionButton
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Saving…" : "Save Changes"}
          </ActionButton>
        </form>
      </section>
    );
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  if (view === "settings") {
    return (
      <section className="space-y-5 pb-28">
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center text-gray-600 dark:text-white/82"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
            </svg>
          </button>
          <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Settings
          </h1>
        </div>

        {/* Profile section */}
        <form onSubmit={submitProfileEdit} className="space-y-4">
          <p className="px-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
            Profile
          </p>

          {profile?.handle ? (
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <span className="text-[0.75rem] text-gray-500 dark:text-white/50">Handle</span>
              <span className="ml-auto font-mono text-[0.82rem] font-semibold text-gray-700 dark:text-white/80">
                @{profile.handle}
              </span>
            </div>
          ) : null}

          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-red-600 dark:text-[#ff7b7b]">
              Display name
            </p>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name (required)"
              className={inputClass}
              style={{ fontSize: "16px" }}
              required
              autoComplete="off"
            />
          </div>

          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-white/60">
              Bio
            </p>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell venues and fans a bit about you (optional)"
              rows={3}
              className={`${inputClass} resize-none`}
              style={{ fontSize: "16px" }}
            />
          </div>

          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-white/60">
              Social handles
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="Instagram handle (optional)"
                className={inputClass}
                style={{ fontSize: "16px" }}
                autoComplete="off"
              />
              <input
                type="text"
                value={tiktokHandle}
                onChange={(e) => setTiktokHandle(e.target.value)}
                placeholder="TikTok handle (optional)"
                className={inputClass}
                style={{ fontSize: "16px" }}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-white/60">
              Content niche
            </p>
            <select
              value={contentNiche}
              onChange={(e) => setContentNiche(e.target.value)}
              className={selectClass}
              style={{ fontSize: "16px" }}
            >
              <option value="">Select a niche (optional)</option>
              {NICHES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>

          {message ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
              {message}
            </div>
          ) : null}

          <ActionButton type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving…" : "Save Profile"}
          </ActionButton>
        </form>

        {/* Payout preferences — no backend endpoint yet */}
        <div>
          <p className="mb-2 px-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
            Payout Preferences
          </p>
          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <div className="space-y-3">
              <input
                type="text"
                disabled
                placeholder="Payment method"
                className={`${inputClass} cursor-not-allowed opacity-40`}
                style={{ fontSize: "16px" }}
              />
              <input
                type="email"
                disabled
                placeholder="Payout email / PayPal"
                className={`${inputClass} cursor-not-allowed opacity-40`}
                style={{ fontSize: "16px" }}
              />
            </div>
            <p className="mt-3 text-[0.75rem] text-gray-400 dark:text-white/35">
              Payout preferences coming soon — no backend endpoint yet.
            </p>
          </div>
        </div>

        {/* Account section */}
        <div>
          <p className="mb-2 px-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
            Account
          </p>
          <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/10">
            <ActionButton
              onClick={() => onNavigate("account")}
              variant="secondary"
              className="w-full"
            >
              Account Settings
            </ActionButton>
          </div>
        </div>
      </section>
    );
  }

  // ─── Earnings ─────────────────────────────────────────────────────────────

  if (view === "earnings") {
    return (
      <section className="space-y-5 pb-28">
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center text-gray-600 dark:text-white/82"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
            </svg>
          </button>
          <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Earnings
          </h1>
        </div>

        {/* Commission totals */}
        <div>
          <p className="mb-2 px-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
            Commission Summary
          </p>
          <div className="flex gap-3">
            <StatCard
              label="Total Earned"
              value={dashboard?.total_commission_earned !== undefined ? `$${dashboard.total_commission_earned}` : "—"}
            />
            <StatCard
              label="Pending"
              value={dashboard?.pending_commission !== undefined ? `$${dashboard.pending_commission}` : "—"}
            />
            <StatCard
              label="Paid Out"
              value={dashboard?.paid_commission !== undefined ? `$${dashboard.paid_commission}` : "—"}
            />
          </div>
        </div>

        {/* Per-offer breakdown placeholder */}
        <div>
          <p className="mb-2 px-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
            Per-Offer Breakdown
          </p>
          <div className="rounded-[20px] border border-dashed border-gray-200 bg-transparent p-6 text-center dark:border-white/10">
            <p className="text-[0.72rem] font-bold uppercase tracking-wide text-gray-400 dark:text-white/35">
              Coming soon
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-white/35">
              Per-offer commission breakdown needs a backend earnings endpoint.
            </p>
          </div>
        </div>

        {/* Payout history placeholder */}
        <div>
          <p className="mb-2 px-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
            Payout History
          </p>
          <div className="rounded-[20px] border border-dashed border-gray-200 bg-transparent p-6 text-center dark:border-white/10">
            <p className="text-[0.72rem] font-bold uppercase tracking-wide text-gray-400 dark:text-white/35">
              Coming soon
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-white/35">
              Payout history needs an influencer_payout_log read endpoint.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ─── Partnerships ─────────────────────────────────────────────────────────

  if (view === "partnerships") {
    return (
      <section className="space-y-5 pb-28">
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center text-gray-600 dark:text-white/82"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
            </svg>
          </button>
          <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Venue Partnerships
          </h1>
        </div>

        <div className="flex min-h-[16rem] flex-col items-center justify-center gap-4 rounded-[22px] border border-dashed border-gray-200 bg-transparent p-8 text-center dark:border-white/10">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-gray-300 dark:text-white/20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div>
            <p className="font-semibold text-gray-700 dark:text-white/80">
              No active partnerships yet
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-white/40">
              Active venue partnerships will appear here once a venue connects with you.
            </p>
            <p className="mt-3 text-[0.72rem] text-gray-300 dark:text-white/25">
              Needs ep_get_influencer_partnerships_dev endpoint
            </p>
          </div>
        </div>
      </section>
    );
  }

  return null;
}
