"use client";

import Image from "next/image";
import { type ReactNode, type RefObject } from "react";

import { type GenieVenue } from "@/app/lib/genieClient";

export type FlowAnchor =
  | "home"
  | "listening"
  | "thinking"
  | "decision"
  | "more"
  | "detail"
  | "saved"
  | "offers"
  | "offer-detail"
  | "offer-activated"
  | "redemptions"
  | "preferences"
  | "account"
  | "vendor"
  | "profile"
  | "dashboard"
  | "contact"
  | "membership";

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

export function BottomDock({
  activeId,
  onHome,
  onSearch,
  onCenter,
}: {
  activeId?: FlowAnchor;
  onHome: () => void;
  onSearch: () => void;
  onCenter: () => void;
}) {
  return (
    <div className="pointer-events-auto fixed bottom-0 left-1/2 z-50 w-[min(100vw,28rem)] -translate-x-1/2">
      <div className="relative flex items-center justify-between bg-white/10 px-10 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2 backdrop-blur-3xl dark:bg-black/30">
        {/* Red line pinned to the very top of the nav bar */}
        <Image
          src="/bottom-red-line.png"
          alt=""
          aria-hidden="true"
          width={448}
          height={4}
          className="absolute inset-x-0 top-0 w-full object-fill"
        />
        <button
          type="button"
          onClick={onHome}
          className={`flex h-10 w-10 items-center justify-center ${
            activeId === "saved" || activeId === "detail"
              ? "opacity-35 dark:opacity-50"
              : ""
          }`}
          aria-label="Go home"
        >
          {/* home_svgrepo.com.png is already red — visible in light mode */}
          <Image
            src="/home_svgrepo.com.png"
            alt="home"
            width={20}
            height={20}
            className="h-5 w-5 object-contain dark:hidden"
          />

          <Image
            src="/home_svgrepo_dark.com.png"
            alt="home"
            width={20}
            height={20}
            className="hidden h-5 w-5 object-contain dark:block"
          />

        </button>

        <button
          type="button"
          onClick={onCenter}
          className="relative -mt-3 flex h-[60px] w-[60px] items-center justify-center"
          aria-label="Start voice search"
        >
          <Image
            src="/Ellipse 120.png"
            alt=""
            fill
            sizes="60px"
            className="object-contain"
          />
        </button>

        <button
          type="button"
          onClick={onSearch}
          className="flex h-10 w-10 items-center justify-center"
          aria-label="Search"
        >
          {/* light mode: red search icon / dark mode: white search icon */}
          <Image
            src="/search_red.png"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 object-contain dark:hidden"
          />
          <Image
            src="/icons/searchIcon.png"
            alt=""
            width={20}
            height={20}
            className="hidden h-5 w-5 object-contain opacity-60 dark:block"
          />
        </button>
      </div>
    </div>
  );
}

export function getVenueDistance(venue: GenieVenue, index: number) {
  if (venue.latitude && venue.longitude) {
    return `${(0.5 + index * 0.7).toFixed(1)} mi`;
  }

  return `${(0.8 + index * 0.9).toFixed(1)} mi`;
}

export function getVenueHeadline(venue: GenieVenue) {
  const parts = [venue.area_neighborhood, venue.city].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : "Houston";
}

export function getVenueStatus(venue: GenieVenue, index: number) {
  if (venue.is_open_now) {
    return "Open now";
  }

  if (venue.best_time_to_go) {
    return venue.best_time_to_go;
  }

  const fallbacks = ["Busy right now", "Good time to go", "Picks up after 9pm"];
  return fallbacks[index % fallbacks.length];
}

export function getVenueStatusTone(venue: GenieVenue, index: number) {
  const fallbackIndex = index % 3;
  if (venue.is_open_now) {
    return fallbackIndex === 1 ? "good" : "open";
  }
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
}: {
  venue: GenieVenue;
  index: number;
  onOpen: () => void;
  onSave?: () => void;
}) {
  void onSave;
  const tone = getVenueStatusTone(venue, index);
  const statusColor =
    tone === "busy"
      ? "bg-red-500"
      : tone === "good"
        ? "bg-green-500"
        : "bg-amber-400";
  const statusText =
    tone === "busy"
      ? "Busy right now"
      : tone === "good"
        ? "Good time to go"
        : "Picks up after 9pm";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full overflow-hidden rounded-[20px] border border-red-200 bg-white text-left shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition hover:shadow-[0_10px_26px_rgba(0,0,0,0.1)] dark:border-[#6a1d1d] dark:bg-black/30 dark:shadow-[0_18px_40px_rgba(0,0,0,0.4)] dark:hover:border-[#ff7b7b]"
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-28 w-28 flex-none overflow-hidden rounded-2xl">
          <Image
            src={venue.image || "/sample-venue-1.jpeg"}
            alt={venue.venue_name || "Venue"}
            fill
            className="object-cover"
            sizes="112px"
          />
        </div>

        <div className="min-w-0 flex-1 py-1">
          <p className="truncate text-[1.1rem] font-semibold leading-tight text-gray-900 dark:text-white">
            {venue.venue_name}
          </p>
          <p className="mt-1 truncate text-[0.82rem] text-gray-500 dark:text-white/60">
            {getVenueHeadlineShort(venue)} - {getVenueDistance(venue, index)}
          </p>

          <p className="mt-1.5 truncate text-[0.88rem] font-medium text-red-500 dark:text-[#ff9d7d]">
            {getVenueTagline(venue)}
          </p>

          <p className="mt-1.5 flex items-center gap-1.5 text-[0.82rem] font-medium text-amber-500 dark:text-amber-300">
            <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
            {statusText}
          </p>
        </div>
      </div>
    </button>
  );
}
