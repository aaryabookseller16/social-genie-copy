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
  | "account"
  | "vendor";

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
      className={`relative overflow-hidden rounded-[28px] border border-gray-100 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(21,0,0,0.92),rgba(56,5,7,0.88)_54%,rgba(18,0,0,0.96))] dark:shadow-[0_24px_80px_rgba(0,0,0,0.38)] dark:backdrop-blur-xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 hidden dark:block dark:bg-[radial-gradient(circle_at_50%_18%,rgba(255,86,86,0.18),transparent_24%),radial-gradient(circle_at_80%_80%,rgba(170,18,18,0.12),transparent_22%)]" />
      <div className="relative">
        {title ? (
          <h2 className="font-[family:var(--font-display)] text-[1.75rem] leading-[0.95] text-gray-900 dark:text-white">
            {title}
          </h2>
        ) : null}
        {subtitle ? (
          <p className="mt-2 max-w-[28rem] text-sm leading-6 text-gray-500 dark:text-white/72">
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
      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/12 dark:bg-black/20 dark:text-white/82";

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
    <div className="flex items-start gap-3 rounded-[22px] border border-red-200 bg-[rgba(255,250,250,0.92)] p-3 dark:border-white/10 dark:bg-black/16">
      <div className="relative h-14 w-14 flex-none overflow-hidden rounded-[18px] border border-red-100 bg-white dark:border-white/10 dark:bg-[#230404]">
        <Image
          src="/genie-profile-pic.png"
          alt="Genie"
          fill
          className="object-cover"
        />
      </div>
      <p
        className={`leading-6 text-gray-800 dark:text-white/82 ${
          compact ? "text-[0.98rem]" : "text-base"
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
      <div className="relative flex items-end justify-between border-t border-red-300 bg-white/95 px-10 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 backdrop-blur-2xl dark:border-[#8a2020] dark:bg-[rgba(11,0,0,0.9)]">
        <button
          type="button"
          onClick={onHome}
          className={`flex h-10 w-10 items-center justify-center ${
            activeId === "saved" || activeId === "detail"
              ? "text-gray-400 dark:text-white/58"
              : "text-red-600 dark:text-[#ff7b7b]"
          }`}
          aria-label="Go home"
        >
          <Image
            src="/home_svgrepo.com.png"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
          />
        </button>

        <button
          type="button"
          onClick={onCenter}
          className="relative -mt-7 flex h-[72px] w-[72px] items-center justify-center"
          aria-label="Start voice search"
        >
          <Image
            src="/Ellipse 120.png"
            alt=""
            fill
            sizes="72px"
            className="object-contain"
          />
        </button>

        <button
          type="button"
          onClick={onSearch}
          className="flex h-10 w-10 items-center justify-center text-gray-400 dark:text-white/58"
          aria-label="Search"
        >
          <Image
            src="/search_icon.png"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
          />
        </button>
      </div>
    </div>
  );
}

function getVenueDistance(venue: GenieVenue, index: number) {
  if (venue.latitude && venue.longitude) {
    return `${(0.5 + index * 0.7).toFixed(1)} mi`;
  }

  return `${(0.8 + index * 0.9).toFixed(1)} mi`;
}

function getVenueHeadline(venue: GenieVenue) {
  const parts = [venue.area_neighborhood, venue.city].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : "Houston";
}

function getVenueStatus(venue: GenieVenue, index: number) {
  if (venue.is_open_now) {
    return "Open now";
  }

  if (venue.best_time_to_go) {
    return venue.best_time_to_go;
  }

  const fallbacks = ["Busy right now", "Good time to go", "Picks up after 9p"];
  return fallbacks[index % fallbacks.length];
}

function getVenueDescription(venue: GenieVenue) {
  return (
    venue.vibe_notes ??
    "Genie thinks this spot matches your vibe for tonight."
  );
}

export function buildVenueTags(venue: GenieVenue) {
  return [
    venue.energy_level,
    venue.crowd,
    venue.music,
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
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full overflow-hidden rounded-[18px] border border-red-200 bg-[rgba(255,251,251,0.96)] text-left shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition hover:shadow-[0_10px_26px_rgba(0,0,0,0.1)] dark:border-[#8c2b2b] dark:bg-black/20 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)] dark:hover:border-[#dc5d5d]"
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-[7.25rem] w-[7.25rem] flex-none overflow-hidden rounded-[14px]">
          <Image
            src={venue.image || "/sample-venue-1.jpeg"}
            alt={venue.venue_name || "Venue"}
            fill
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[1.1rem] font-semibold leading-6 text-gray-900 dark:text-white">
                {venue.venue_name}
              </p>
              <p className="mt-0.5 truncate text-[0.75rem] text-gray-500 dark:text-white/55">
                {getVenueHeadline(venue)} - {getVenueDistance(venue, index)}
              </p>
            </div>
            {onSave ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSave();
                }}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500 hover:border-red-300 hover:text-red-600 dark:border-white/12 dark:bg-black/24 dark:text-white/60 dark:hover:border-white/30 dark:hover:text-white"
              >
                Save
              </button>
            ) : null}
          </div>

          <p className="mt-1 text-[0.76rem] leading-4 text-red-500 dark:text-[#ff9d7d]">
            {buildVenueTags(venue)[0] || "Lively sports bar"}
          </p>

          <p className="mt-1 line-clamp-2 text-[0.82rem] leading-4 text-gray-600 dark:text-white/72">
            {getVenueDescription(venue)}
          </p>

          <p className="mt-2 flex items-center gap-1.5 text-[0.78rem] text-[#ff9b45] dark:text-[#ffb45d]">
            <span className={`inline-block h-2 w-2 rounded-full ${
              venue.is_open_now ? "bg-[#f7c948]" : "bg-orange-400 dark:bg-[#ff9f4f]"
            }`} />
            {getVenueStatus(venue, index)}
          </p>
        </div>
      </div>
    </button>
  );
}
