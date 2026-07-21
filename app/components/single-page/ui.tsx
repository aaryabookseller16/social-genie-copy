"use client";

import Image from "next/image";
import { useState, type ReactNode, type RefObject } from "react";

import { type GenieVenue } from "@/app/lib/genieClient";
import { getDistanceLabel } from "@/app/lib/geo";

export type FlowAnchor =
  | "home"
  | "homescreen"
  | "listening"
  | "thinking"
  | "decision"
  | "more"
  | "detail"
  | "saved"
  | "offers"
  | "events-tab"
  | "venues-tab"
  | "offer-detail"
  | "offer-activated"
  | "redemptions"
  | "preferences"
  | "account"
  | "choose-plan"
  | "role-identifier"
  | "role-setup"
  | "onboarding-complete"
  | "vendor"
  | "producer-dashboard"
  | "influencer-dashboard"
  | "role-unlock"
  | "profile"
  | "dashboard"
  | "contact"
  | "event-detail"
  | "event-survey"
  | "vibbee-trial"
  | "membership"
  | "notifications"
  | "notification-settings"
  | "messages"
  | "conversation";

function normalizeBenefitLabel(value: string) {
  return value.replace(" and ", " & ");
}

export function toMonthlyPriceLabel(value: string) {
  if (value.includes("/mo")) {
    return value.replace("/mo", " / month");
  }

  if (value.includes("/month")) {
    return value.replace("/month", " / month");
  }

  return value;
}

export function BenefitList({ benefits }: { benefits: string[] }) {
  return (
    <ul className="mt-2.5 space-y-1 text-[13px] leading-relaxed text-gray-600 dark:text-white/75">
      {benefits.map((benefit) => (
        <li key={benefit} className="flex items-center gap-2.5">
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 flex-none text-red-500 dark:text-[#e8a45f]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3.25 8.5 2.5 2.5 6-6" />
          </svg>
          <span>{normalizeBenefitLabel(benefit)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Genie intro card + the Free / V.I.Bee plan cards. Shared by the logged-out
 * pitch screen (marketing — both cards just open the signup form) and the
 * post-verification plan chooser (where the tier is actually committed).
 */
export function PlanCards({
  freeBenefits,
  vibeeBenefits,
  vibeeMonthlyPrice,
  onSelectFree,
  onSelectVibee,
  disabled = false,
}: {
  freeBenefits: string[];
  vibeeBenefits: string[];
  vibeeMonthlyPrice: string;
  onSelectFree: () => void;
  onSelectVibee: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="rounded-[22px] border border-red-400 bg-transparent px-3 py-2.5 dark:border-white/20 dark:bg-black/25 dark:backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative h-[82px] w-[82px] flex-none overflow-hidden rounded-full border-2 border-red-400 shadow-[0_0_16px_rgba(220,38,38,0.35)]">
            <Image
              src="/genie-profile-pic.png"
              alt="Genie"
              width={82}
              height={82}
              className="h-full w-full object-cover"
            />
          </div>
          <h2 className="text-[1.45rem] leading-tight text-gray-900 dark:text-white">
            Hi, I&apos;m Genie,
            <br />
            your social concierge.
          </h2>
        </div>
      </div>

      <div className="mt-8 space-y-3.5">
        <button
          type="button"
          onClick={onSelectFree}
          disabled={disabled}
          className="w-full rounded-[22px] border border-red-400 bg-transparent px-4 py-3.5 text-left transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:bg-black/25 dark:backdrop-blur-sm dark:hover:bg-black/35"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-14 w-14 flex-none items-center justify-center rounded-xl border-2 border-red-500 dark:border-0 dark:bg-transparent dark:p-0">
              <Image
                src="/free (1) 1 (1).png"
                alt="Free plan"
                width={44}
                height={44}
                className="h-9 w-9 object-contain dark:hidden"
              />
              <Image
                src="/free (1) 1.png"
                alt="Free plan"
                width={44}
                height={44}
                className="hidden h-11 w-11 object-contain dark:block"
              />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-red-600 dark:text-[#ff7b7b]">
                Get started for free
              </p>
              <BenefitList benefits={freeBenefits} />
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectVibee}
          disabled={disabled}
          className="w-full rounded-[22px] border border-red-400 bg-transparent px-4 py-3.5 text-left transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:bg-black/25 dark:backdrop-blur-sm dark:hover:bg-black/35"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-14 w-14 flex-none items-center justify-center rounded-xl border-2 border-red-500 dark:border-0 dark:bg-transparent dark:p-0">
              <Image
                src="/bee-red 1 (1).png"
                alt="V.I. Bee"
                width={44}
                height={44}
                className="h-9 w-9 object-contain dark:hidden"
              />
              <Image
                src="/bee-red 1.png"
                alt="V.I. Bee"
                width={44}
                height={44}
                className="hidden h-11 w-11 object-contain dark:block"
              />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-red-600 dark:text-[#ff7b7b]">
                Become a V.I. Bee
              </p>
              <p className="mt-0.5 text-[16px]">
                {toMonthlyPriceLabel(vibeeMonthlyPrice)}
              </p>
              <BenefitList benefits={vibeeBenefits} />
            </div>
          </div>
        </button>
      </div>
    </>
  );
}

export function BackIcon({
  size = 20,
  className = "h-5 w-5 object-contain",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <>
      <Image
        src="/icons/Back-red.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`${className} dark:hidden`}
      />
      <Image
        src="/icons/Back.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`hidden ${className} dark:block`}
      />
    </>
  );
}

export function SectionShell({
  sectionRef,
  title,
  subtitle,
  children,
  className = "",
}: {
  sectionRef?: RefObject<HTMLElement | null>;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      ref={sectionRef}
      className={`relative overflow-hidden rounded-[28px] border border-gray-100 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:border-transparent dark:bg-transparent dark:shadow-none ${className}`}
    >
      <div className="relative">
        {title ? (
          <h2 className="font-[family:var(--font-display)] text-[1.75rem] leading-[0.95] text-gray-900 dark:text-white">
            {title}
          </h2>
        ) : null}
        {subtitle ? (
          <p className="mt-2 max-w-[28rem] text-sm leading-6 text-gray-500 dark:text-white/70">
            {subtitle}
          </p>
        ) : null}
        <div className={title || subtitle ? "mt-5" : ""}>{children}</div>
      </div>
    </section>
  );
}

export function Field({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-600 dark:text-white/72">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
      />
    </label>
  );
}

export function ActionButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
  disabled?: boolean;
  className?: string;
}) {
  const variantClasses =
    variant === "primary"
      ? "border-red-500 bg-red-600 text-white shadow-sm hover:bg-red-700 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))] dark:shadow-[0_0_0_1px_rgba(255,120,120,0.08),0_18px_36px_rgba(0,0,0,0.28)]"
      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/20 dark:!bg-[rgba(255,255,255,0.08)] dark:text-white dark:hover:bg-[rgba(255,255,255,0.13)]";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[18px] border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${variantClasses} ${className}`}
    >
      {children}
    </button>
  );
}

export function TagPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 dark:border-white/10 dark:bg-black/20 dark:text-white/70">
      {children}
    </span>
  );
}

export function GenieBubble({
  copy,
  compact = false,
}: {
  copy: string;
  compact?: boolean;
}) {
  return (
    <div className="relative flex items-center gap-3 rounded-[22px] border border-red-200 bg-[rgba(255,250,250,0.92)] py-3 pl-16 pr-4 dark:border-white/10 dark:bg-black/16">
      <div className="absolute -left-2 -bottom-1 -top-2 w-19">
        <Image
          src="/icons/top_bar_genie.png"
          alt="Genie"
          width={80}
          height={100}
          className="h-full w-full object-contain object-bottom drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
        />
      </div>
      <p
        className={`leading-5 text-gray-800 dark:text-white/82 ${
          compact ? "text-[0.9rem]" : "text-[0.95rem]"
        }`}
      >
        {copy}
      </p>
    </div>
  );
}

function OffersDockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="9.5" r="1.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15" cy="14.5" r="1.6" stroke="currentColor" strokeWidth="1.6" />
      <line x1="8" y1="16" x2="16" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EventsDockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" stroke="currentColor" strokeWidth="1.8" />
      <line x1="7.5" y1="3" x2="7.5" y2="6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16.5" y1="3" x2="16.5" y2="6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="12.5" x2="12" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9.25" y1="14.75" x2="14.75" y2="14.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Two-tower building outline — the dock's Venues slot. */
function VenuesDockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 21V8.5a1 1 0 0 1 .6-.92l6-2.5A1 1 0 0 1 12 6v15" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 21V11h6.5a1 1 0 0 1 1 1v9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="2.5" y1="21" x2="21.5" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="7" y1="10.5" x2="9" y2="10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="7" y1="14" x2="9" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="7" y1="17.5" x2="9" y2="17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="15" y1="14.5" x2="16.5" y2="14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="15" y1="17.5" x2="16.5" y2="17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BottomDock({
  activeId,
  onHome,
  onVenues,
  onCenter,
  onOffers,
  onEvents,
}: {
  activeId?: FlowAnchor;
  onHome: () => void;
  onVenues: () => void;
  onCenter: () => void;
  onOffers: () => void;
  onEvents: () => void;
}) {
  const isVenuesActive = activeId === "venues-tab";
  // Account/profile/vendor no longer have a dock slot (they live in the drawer),
  // but they must still suppress the home highlight — otherwise the home icon
  // reads as active while the user is sitting on their profile.
  const isAccountScreen =
    activeId === "account" ||
    activeId === "profile" ||
    activeId === "preferences" ||
    activeId === "membership" ||
    activeId === "contact" ||
    activeId === "dashboard" ||
    activeId === "vendor";
  const isOffersActive =
    activeId === "offers" ||
    activeId === "offer-detail" ||
    activeId === "offer-activated" ||
    activeId === "redemptions";
  const isEventsActive = activeId === "events-tab";
  const isHomeActive =
    !isAccountScreen &&
    !isVenuesActive &&
    !isOffersActive &&
    !isEventsActive &&
    (activeId === "homescreen" || activeId === "home" || !activeId);

  return (
    <div className="pointer-events-none fixed bottom-0 left-1/2 z-[80] w-[min(100vw,28rem)] -translate-x-1/2">
      <div className="pointer-events-auto relative flex items-center justify-between bg-white/10 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2 backdrop-blur-3xl dark:bg-black/30">
        {/* Red line pinned to the very top of the nav bar */}
        <Image
          src="/bottom-red-line.png"
          alt=""
          aria-hidden="true"
          width={448}
          height={4}
          className="pointer-events-none absolute inset-x-0 top-0 w-full object-fill"
        />
        <button
          type="button"
          onClick={onHome}
          className={`relative z-10 flex h-12 w-12 touch-manipulation items-center justify-center ${
            isHomeActive ? "opacity-100" : "opacity-40 dark:opacity-45"
          }`}
          aria-label="Go home"
          aria-current={isHomeActive ? "page" : undefined}
        >
          <Image
            src="/home_svgrepo.com.png"
            alt=""
            aria-hidden="true"
            width={28}
            height={28}
            className="pointer-events-none h-7 w-7 object-contain dark:hidden"
          />
          <Image
            src="/home_svgrepo_dark.com.png"
            alt=""
            aria-hidden="true"
            width={28}
            height={28}
            className="pointer-events-none hidden h-7 w-7 object-contain dark:block"
          />
        </button>

        <button
          type="button"
          onClick={onOffers}
          className={`relative z-10 flex h-12 w-12 touch-manipulation items-center justify-center text-red-600 dark:text-white ${
            isOffersActive ? "opacity-100" : "opacity-40 dark:opacity-45"
          }`}
          aria-label="Open offers"
          aria-current={isOffersActive ? "page" : undefined}
        >
          <OffersDockIcon className="h-7 w-7" />
        </button>

        <button
          type="button"
          onClick={onCenter}
          className="relative z-10 -mt-3 flex h-[60px] w-[60px] touch-manipulation items-center justify-center"
          aria-label="Start voice search"
        >
          <Image
            src="/Ellipse 120.png"
            alt=""
            fill
            sizes="60px"
            className="pointer-events-none object-contain"
          />
        </button>

        <button
          type="button"
          onClick={onEvents}
          className={`relative z-10 flex h-12 w-12 touch-manipulation items-center justify-center text-red-600 dark:text-white ${
            isEventsActive ? "opacity-100" : "opacity-40 dark:opacity-45"
          }`}
          aria-label="Open events"
          aria-current={isEventsActive ? "page" : undefined}
        >
          <EventsDockIcon className="h-7 w-7" />
        </button>

        <button
          type="button"
          onClick={onVenues}
          className={`relative z-10 flex h-12 w-12 touch-manipulation items-center justify-center text-red-600 dark:text-white ${
            isVenuesActive ? "opacity-100" : "opacity-40 dark:opacity-45"
          }`}
          aria-label="Open venues"
          aria-current={isVenuesActive ? "page" : undefined}
        >
          <VenuesDockIcon className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}

/**
 * Real-world distance label between the user and a venue.
 *
 * Previously this returned synthetic values keyed off the list index
 * (`0.5 + index * 0.7`) — which is why the venue detail screen showed
 * numbers that had nothing to do with the user's actual location.
 *
 * Now it prefers the user's real coordinates. When they aren't available
 * (permission denied, SSR, missing venue lat/lng) it returns `null` so the
 * UI can hide the distance entirely instead of showing a misleading number.
 */
export function getVenueDistance(
  venue: GenieVenue,
  _index: number,
  userCoords?: { lat: number; lng: number } | null
): string | null {
  const venueLat = typeof venue.latitude === "number" ? venue.latitude : null;
  const venueLng = typeof venue.longitude === "number" ? venue.longitude : null;
  return getDistanceLabel(userCoords, venueLat, venueLng);
}

export function getVenueHeadline(venue: GenieVenue) {
  const parts = [venue.area_neighborhood, venue.city].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : "Houston";
}

// Maps the live social_energy_state (from venue_checkins, refreshed every 5
// min server-side) onto the badge copy/tone shown in venue lists.
const SOCIAL_ENERGY_STATUS: Record<string, { text: string; tone: "busy" | "good" | "picks" }> = {
  "On Fire": { text: "Packed right now", tone: "busy" },
  "Buzzing": { text: "Busy right now", tone: "busy" },
  "Getting Attention": { text: "Good time to go", tone: "good" },
  "Quiet": { text: "Picks up after 9pm", tone: "picks" },
};

export function getVenueStatus(venue: GenieVenue, index: number) {
  if (venue.is_open_now) {
    return "Open now";
  }

  const energyStatus = venue.social_energy_state ? SOCIAL_ENERGY_STATUS[venue.social_energy_state] : undefined;
  if (energyStatus) {
    return energyStatus.text;
  }

  if (venue.best_time_to_go) {
    return venue.best_time_to_go;
  }

  const fallbacks = ["Busy right now", "Good time to go", "Picks up after 9pm"];
  return fallbacks[index % fallbacks.length];
}

export function getVenueStatusTone(venue: GenieVenue, index: number) {
  if (venue.is_open_now) {
    return "open" as const;
  }

  const energyStatus = venue.social_energy_state ? SOCIAL_ENERGY_STATUS[venue.social_energy_state] : undefined;
  if (energyStatus) {
    return energyStatus.tone;
  }

  const fallbackIndex = index % 3;
  return ["busy", "good", "picks"][fallbackIndex] as "busy" | "good" | "picks";
}

export function getVenueHeadlineShort(venue: GenieVenue) {
  return (
    venue.area_neighborhood ||
    venue.neighborhood_text ||
    venue.city ||
    "Houston"
  );
}

export function getVenueTagline(venue: GenieVenue) {
  // Short red line — energy or crowd first
  if (venue.energy_level && venue.crowd) {
    return `${venue.energy_level}-energy ${venue.crowd.split(",")[0].split(" ").slice(0, 2).join(" ").toLowerCase()}`;
  }
  return venue.energy_level || "Lively spot";
}

export function getVenueDescription(venue: GenieVenue) {
  return (
    venue.vibe_notes ??
    "Genie thinks this spot matches your vibe for tonight."
  );
}

// Genie's Take — review intelligence shown on every venue detail. Uses
// curated vibe_notes when available, otherwise composes a fallback from the
// venue's attributes so no venue is left without a take.
export function getGenieTake(venue: GenieVenue) {
  const notes = venue.vibe_notes?.trim();
  if (notes) return notes;

  const parts: string[] = [];
  const energy = venue.energy_level?.trim();
  const crowd = venue.crowd?.split(",")[0].trim();
  if (energy && crowd) {
    parts.push(`A ${energy.toLowerCase()}-energy pick for a ${crowd.toLowerCase()} crowd.`);
  } else if (energy) {
    parts.push(`A ${energy.toLowerCase()}-energy spot.`);
  } else if (crowd) {
    parts.push(`Popular with a ${crowd.toLowerCase()} crowd.`);
  }

  const music = venue.music?.split(",")[0].trim();
  if (music) parts.push(`Expect ${music.toLowerCase()}.`);

  const cuisine = Array.isArray(venue.cuisine_tags) && venue.cuisine_tags.length
    ? String(venue.cuisine_tags[0])
    : null;
  if (cuisine) parts.push(`Known for ${cuisine.toLowerCase()}.`);

  const rating = typeof venue.google_rating === "number" ? venue.google_rating : null;
  const reviewCount = venue.google_user_ratings_total ?? null;
  if (rating && reviewCount) {
    parts.push(`Reviewers give it ${rating.toFixed(1)}★ across ${reviewCount} ratings.`);
  } else if (rating) {
    parts.push(`Reviewers give it ${rating.toFixed(1)}★.`);
  }

  if (parts.length === 0) {
    return "Genie thinks this spot matches the vibe you're after tonight.";
  }
  return parts.join(" ");
}

export function getOpenUntil(venue: GenieVenue) {
  const text = venue.hours_json?.weekday_text;
  if (!text || !Array.isArray(text) || text.length === 0) return null;
  const today = new Date().getDay();
  const idx = today === 0 ? 6 : today - 1;
  const line = text[idx];
  if (!line) return null;
  const m = line.match(/([0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM))\s*$/i);
  return m ? `Open until ${m[1]}` : null;
}

export function buildVenueTags(venue: GenieVenue) {
  const cuisineArr = Array.isArray(venue.cuisine_tags) ? venue.cuisine_tags : [];
  return [
    venue.energy_level,
    ...cuisineArr.map((c) => String(c).charAt(0).toUpperCase() + String(c).slice(1)),
    venue.crowd ? venue.crowd.split(",")[0].split(" ").slice(0, 2).join(" ") : null,
    venue.music ? venue.music.split(",")[0].split(" ").slice(0, 2).join(" ") : null,
    venue.price_band ? `Price: ${venue.price_band}` : null,
    venue.is_official_vendor ? "Official Vendor" : null,
    venue.is_vendor_subscriber ? "Featured" : null,
  ].filter(Boolean) as string[];
}

export function ResultCard({
  venue,
  index,
  onOpen,
  onSave,
  userCoords,
  tagline,
  description,
  status,
  fallbackImage,
}: {
  venue: GenieVenue;
  index: number;
  onOpen: () => void;
  onSave?: () => void;
  userCoords?: { lat: number; lng: number } | null;
  /**
   * Overrides the derived energy tagline. Pass `null` to drop the line
   * entirely — sources with no energy data would otherwise render the same
   * "Lively spot" placeholder on every card.
   */
  tagline?: string | null;
  /** Optional blurb under the tagline; omitted when absent. */
  description?: string | null;
  /**
   * Overrides the derived status line. Pass `null` to drop it — for sources
   * with no `is_open_now` / `social_energy_state`, getVenueStatus invents one
   * from the list index, which is worse than showing nothing.
   */
  status?: string | null;
  /**
   * Image shown when the venue has no usable photo. Defaults to the stock
   * photo; pass `null` for an empty placeholder instead of a stand-in that
   * isn't this venue.
   */
  fallbackImage?: string | null;
}) {
  void onSave;
  // Many venue photos are dead Google Places URLs (403). Without this the card
  // renders a broken-image glyph and its alt text.
  const [imageFailed, setImageFailed] = useState(false);
  const taglineText = tagline === undefined ? getVenueTagline(venue) : tagline;
  const resolvedFallback =
    fallbackImage === undefined ? "/sample-venue-1.jpeg" : fallbackImage;
  const imageSrc = !imageFailed && venue.image ? venue.image : resolvedFallback;
  const tone = getVenueStatusTone(venue, index);
  const statusColor =
    tone === "busy"
      ? "bg-red-500"
      : tone === "good" || tone === "open"
        ? "bg-green-500"
        : "bg-amber-400";
  const statusText = status === undefined ? getVenueStatus(venue, index) : status;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full overflow-hidden rounded-[20px] border border-red-200 bg-white text-left shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition hover:shadow-[0_10px_26px_rgba(0,0,0,0.1)] dark:border-[#6a1d1d] dark:bg-black/30 dark:shadow-[0_18px_40px_rgba(0,0,0,0.4)] dark:hover:border-[#ff7b7b]"
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-28 w-28 flex-none overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/5">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={venue.venue_name || "Venue"}
              fill
              className="object-cover"
              sizes="112px"
              onError={() => setImageFailed(true)}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 py-1">
          <p className="truncate text-[1.1rem] font-semibold leading-tight text-gray-900 dark:text-white">
            {venue.venue_name}
          </p>
          <p className="mt-1 truncate text-[0.82rem] text-gray-500 dark:text-white/60">
            {getVenueHeadlineShort(venue)}
            {(() => {
              const distance = getVenueDistance(venue, index, userCoords);
              return distance ? ` - ${distance}` : "";
            })()}
          </p>

          {taglineText ? (
            <p className="mt-1.5 truncate text-[0.88rem] font-medium text-red-500 dark:text-[#ff9d7d]">
              {taglineText}
            </p>
          ) : null}

          {description ? (
            <p className="mt-1.5 line-clamp-2 text-[0.8rem] leading-4 text-gray-500 dark:text-white/55">
              {description}
            </p>
          ) : null}

          {statusText ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.82rem] font-medium text-amber-500 dark:text-amber-300">
              <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
              {statusText}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}
export function EventResultCard({
  evt,
  onOpen,
}: {
  evt: { id: number; title: string; cover_image_url?: string; event_date?: string; start_time?: string; venue_address?: string; category?: string; is_free?: boolean; ticket_price_min?: number; ticket_url?: string; public_slug?: string };
  onOpen: () => void;
}) {
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
          <p className="truncate text-[1.1rem] font-semibold leading-tight text-gray-900 dark:text-white">
            {evt.title}
          </p>
          <p className="mt-1 truncate text-[0.82rem] text-gray-500 dark:text-white/60">
            {evt.event_date
              ? new Date(evt.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : ""}
            {evt.start_time ? ` · ${evt.start_time.slice(0, 5)}` : ""}
          </p>
          <p className="mt-1.5 truncate text-[0.88rem] font-medium text-red-500 dark:text-[#ff9d7d]">
            {evt.venue_address ?? ""}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[0.82rem] font-medium text-amber-500 dark:text-amber-300">
            {evt.is_free ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Free entry
              </>
            ) : evt.ticket_price_min ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                From ${evt.ticket_price_min}
              </>
            ) : evt.category ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                {evt.category}
              </>
            ) : null}
          </p>
        </div>
      </div>
    </button>
  );
}
