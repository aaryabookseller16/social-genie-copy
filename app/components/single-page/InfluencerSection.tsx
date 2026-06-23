"use client";

import Image from "next/image";
import React, { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { ActionButton } from "@/app/components/single-page/ui";
import { type FlowAnchor } from "@/app/components/single-page/ui";
import { type ConsumerAccount } from "@/app/lib/localState";
import {
  createInfluencerProfile,
  fetchInfluencerDashboard,
  fetchInfluencerOffers,
  fetchMyInfluencerProfile,
  type InfluencerDashboardData,
  type InfluencerOffer,
  type MyInfluencerProfile,
} from "@/app/lib/publicApiClient";

// ─── Types ───────────────────────────────────────────────────────────────────

type View =
  | "loading"
  | "onboarding"
  | "dashboard"
  | "offers"
  | "offer-detail"
  | "profile-edit"
  | "settings"
  | "earnings"
  | "partnerships";

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
          <span className="mb-1.5 inline-block rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[0.68rem] font-semibold text-red-600 dark:border-white/10 dark:bg-black/20 dark:text-white/70">
            {formatOfferType(offer.offer_type)}
          </span>
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

export function InfluencerSection({ account, onNavigate }: Props) {
  const [view, setView] = useState<View>("loading");
  const [profile, setProfile] = useState<MyInfluencerProfile | null>(null);
  const [dashboard, setDashboard] = useState<InfluencerDashboardData | null>(null);
  const [offers, setOffers] = useState<InfluencerOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<InfluencerOffer | null>(null);

  // Onboarding / profile-edit form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [contentNiche, setContentNiche] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const openOffers = useCallback(async () => {
    setView("offers");
    if (!profile?.handle) return;
    setIsLoadingOffers(true);
    try {
      const res = await fetchInfluencerOffers(profile.handle);
      setOffers(res.offers ?? []);
    } catch {
      setOffers([]);
    } finally {
      setIsLoadingOffers(false);
    }
  }, [profile]);

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
              <div className="relative h-14 w-14 flex-none overflow-hidden rounded-full border-2 border-red-400 shadow-[0_0_12px_rgba(220,38,38,0.3)]">
                <Image
                  src={profile.profile_image_url}
                  alt={profile.display_name ?? ""}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </div>
            ) : (
              <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full border-2 border-red-400 bg-red-600 text-xl font-bold text-white shadow-[0_0_12px_rgba(220,38,38,0.3)]">
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
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
            {dashOffers.length > 0 ? (
              <button
                type="button"
                onClick={openOffers}
                className="text-[0.72rem] font-medium text-gray-500 underline dark:text-white/50"
              >
                View all
              </button>
            ) : null}
          </div>

          {dashOffers.length > 0 ? (
            <div className="space-y-3">
              {dashOffers.slice(0, 3).map((offer) => (
                <OfferRow
                  key={offer.id}
                  offer={offer}
                  onTap={() => {
                    setSelectedOffer(offer);
                    setView("offer-detail");
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-gray-200 bg-transparent p-6 text-center dark:border-white/10">
              <p className="text-sm text-gray-500 dark:text-white/50">
                No offer codes yet — a venue partner will create these for you.
              </p>
              <button
                type="button"
                onClick={openOffers}
                className="mt-3 text-sm font-medium text-red-600 dark:text-[#ff7b7b]"
              >
                Check offer list →
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
          <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Offer Codes
          </h1>
        </div>

        {isLoadingOffers ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-red-600" />
          </div>
        ) : offers.length > 0 ? (
          <div className="space-y-3">
            {offers.map((offer) => (
              <OfferRow
                key={offer.id}
                offer={offer}
                onTap={() => {
                  setSelectedOffer(offer);
                  setView("offer-detail");
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-gray-200 bg-transparent p-8 text-center dark:border-white/10">
            <p className="text-sm text-gray-500 dark:text-white/50">
              No active offer codes found.
            </p>
            <p className="mt-1 text-[0.78rem] text-gray-400 dark:text-white/35">
              Venue partners create offer codes for you once your profile is live.
            </p>
          </div>
        )}
      </section>
    );
  }

  // ─── Offer detail ─────────────────────────────────────────────────────────

  if (view === "offer-detail" && selectedOffer) {
    const offer = selectedOffer;
    const discount = formatDiscount(offer.discount_value, offer.discount_type);

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

        <div className="rounded-[22px] border border-gray-100 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm">
          <span className="mb-3 inline-block rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[0.68rem] font-semibold text-red-600 dark:border-white/10 dark:bg-black/20 dark:text-white/70">
            {formatOfferType(offer.offer_type)}
          </span>
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

        {/* Stats */}
        <div className="flex gap-3">
          <StatCard label="Redemptions" value={offer.redemptions_used ?? offer.redemption_count} />
          {offer.max_redemptions ? (
            <StatCard label="Max Allowed" value={offer.max_redemptions} />
          ) : null}
        </div>

        {/* Redemption history placeholder */}
        <div className="rounded-[20px] border border-dashed border-gray-200 bg-transparent p-5 text-center dark:border-white/10">
          <p className="text-[0.72rem] font-bold uppercase tracking-wide text-gray-400 dark:text-white/35">
            Redemption history
          </p>
          <p className="mt-1 text-sm text-gray-400 dark:text-white/35">
            Per-user redemption detail coming soon.
          </p>
          {/* FLAG: needs influencer/offer-analytics #2766 to list individual redemptions */}
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
