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

export type BottomDockItem = {
  id: FlowAnchor;
  label: string;
  icon: ReactNode;
};

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
    <div className="flex items-start gap-3 rounded-[24px] border border-red-100 bg-red-50/40 p-3 dark:border-white/10 dark:bg-black/16">
      <div className="relative h-14 w-14 flex-none overflow-hidden rounded-[18px] border border-red-100 bg-white dark:border-white/10 dark:bg-[#230404]">
        <Image
          src="/genie-profile-pic.png"
          alt="Genie"
          fill
          className="object-cover"
        />
      </div>
      <p
        className={`leading-6 text-gray-700 dark:text-white/82 ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        {copy}
      </p>
    </div>
  );
}

export function BottomDock({
  items,
  activeId,
  compact = false,
  onSelect,
}: {
  items: BottomDockItem[];
  activeId?: FlowAnchor;
  compact?: boolean;
  onSelect: (id: FlowAnchor) => void;
}) {
  if (compact) {
    return (
      <div className="pointer-events-auto fixed bottom-0 left-1/2 z-50 w-[min(100vw,28rem)] -translate-x-1/2">
        <div className="border-t border-gray-100 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3 backdrop-blur-2xl dark:border-white/16 dark:bg-[rgba(11,0,0,0.88)]">
          <button
            type="button"
            onClick={() => onSelect("home")}
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-400 bg-[radial-gradient(circle,rgba(220,38,38,0.95),rgba(185,28,28,1)_70%)] shadow-[0_4px_16px_rgba(220,38,38,0.35)] dark:border-[#e65d5d]/75 dark:bg-[radial-gradient(circle,rgba(255,75,75,0.9),rgba(130,9,11,0.94)_70%)] dark:shadow-[0_0_24px_rgba(255,57,57,0.55)]"
            aria-label="Go home"
          >
            <Image src="/genie-profile-pic.png" alt="" width={28} height={28} className="rounded-full" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto fixed bottom-0 left-1/2 z-50 w-[min(100vw,28rem)] -translate-x-1/2">
      <div className="flex items-center justify-between border-t border-gray-100 bg-white/95 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2 backdrop-blur-2xl dark:border-white/12 dark:bg-[rgba(11,0,0,0.82)]">
        {items.slice(0, 2).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`flex flex-col items-center gap-1 p-2 text-[0.65rem] uppercase tracking-[0.12em] ${
              activeId === item.id ? "text-red-600 dark:text-white" : "text-gray-400 dark:text-white/58"
            }`}
          >
            <span className={activeId === item.id ? "text-red-600 dark:text-[#ff7b7b]" : "text-gray-400 dark:text-white/76"}>{item.icon}</span>
            {item.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onSelect("home")}
          className="relative -mt-6 mx-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400 bg-[radial-gradient(circle,rgba(220,38,38,0.95),rgba(185,28,28,1)_70%)] shadow-[0_4px_20px_rgba(220,38,38,0.4)] dark:border-[#e65d5d]/75 dark:bg-[radial-gradient(circle,rgba(255,75,75,0.9),rgba(130,9,11,0.94)_70%)] dark:shadow-[0_0_24px_rgba(255,57,57,0.55)]"
        >
          <Image src="/genie-profile-pic.png" alt="Genie" width={32} height={32} className="rounded-full" />
        </button>

        {items.slice(2).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`flex flex-col items-center gap-1 p-2 text-[0.65rem] uppercase tracking-[0.12em] ${
              activeId === item.id ? "text-red-600 dark:text-white" : "text-gray-400 dark:text-white/58"
            }`}
          >
            <span className={activeId === item.id ? "text-red-600 dark:text-[#ff7b7b]" : "text-gray-400 dark:text-white/76"}>{item.icon}</span>
            {item.label}
          </button>
        ))}
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
      className="w-full overflow-hidden rounded-[20px] border border-gray-100 bg-white text-left shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition hover:shadow-[0_4px_24px_rgba(0,0,0,0.1)] dark:border-[#8c2b2b] dark:bg-black/20 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)] dark:hover:border-[#dc5d5d]"
    >
      <div className="relative h-44 w-full">
        <Image
          src={venue.image || "/sample-venue-1.jpeg"}
          alt={venue.venue_name || "Venue"}
          fill
          className="object-cover"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {venue.venue_name}
            </p>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-white/55">
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
        <div className="mt-2 flex flex-wrap gap-1.5">
          {buildVenueTags(venue).slice(0, 2).map((tag) => (
            <TagPill key={tag}>{tag}</TagPill>
          ))}
        </div>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-white/72">
          {getVenueDescription(venue)}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 dark:text-[#ffb45d]">
          <span className={`inline-block h-2 w-2 rounded-full ${
            venue.is_open_now ? "bg-green-500 dark:bg-[#4ade80]" : "bg-orange-400 dark:bg-[#ff9f4f]"
          }`} />
          {getVenueStatus(venue, index)}
        </p>
      </div>
    </button>
  );
}
