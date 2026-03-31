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
      className={`relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,0,0,0.92),rgba(56,5,7,0.88)_54%,rgba(18,0,0,0.96))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,86,86,0.18),transparent_24%),radial-gradient(circle_at_80%_80%,rgba(170,18,18,0.12),transparent_22%)]" />
      <div className="relative">
        {title ? (
          <h2 className="font-[family:var(--font-display)] text-[2rem] leading-[0.95] text-white">
            {title}
          </h2>
        ) : null}
        {subtitle ? (
          <p className="mt-2 max-w-[28rem] text-sm leading-6 text-white/72">
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
      <span className="mb-2 block text-sm font-medium text-white/72">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[16px] border border-[#b74c4c]/55 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#ff6a6a] focus:outline-none"
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
      ? "border-[#d75050] bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))] text-white shadow-[0_0_0_1px_rgba(255,120,120,0.08),0_18px_36px_rgba(0,0,0,0.28)]"
      : "border-white/12 bg-black/20 text-white/82";

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
    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
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
    <div className="flex items-start gap-3 rounded-[24px] border border-white/10 bg-black/16 p-3">
      <div className="relative h-14 w-14 flex-none overflow-hidden rounded-[18px] border border-white/10 bg-[#230404]">
        <Image
          src="/genie-profile-pic.png"
          alt="Genie"
          fill
          className="object-cover"
        />
      </div>
      <p
        className={`leading-6 text-white/82 ${
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
  onSelect,
}: {
  items: BottomDockItem[];
  activeId?: FlowAnchor;
  onSelect: (id: FlowAnchor) => void;
}) {
  return (
    <div className="pointer-events-auto fixed bottom-5 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2">
      <div className="grid grid-cols-[1fr_1fr_5rem_1fr_1fr] items-center rounded-full border border-white/12 bg-[rgba(11,0,0,0.82)] px-3 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        {items.slice(0, 2).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`flex flex-col items-center gap-1 text-[0.68rem] uppercase tracking-[0.18em] ${
              activeId === item.id ? 'text-white' : 'text-white/58'
            }`}
          >
            <span className={activeId === item.id ? 'text-[#ff7b7b]' : 'text-white/76'}>{item.icon}</span>
            {item.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onSelect("home")}
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#e65d5d]/75 bg-[radial-gradient(circle,rgba(255,75,75,0.9),rgba(130,9,11,0.94)_70%)] shadow-[0_0_24px_rgba(255,57,57,0.55)]"
        >
          <span className="relative inline-flex h-5 w-5 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-white/18 blur-sm" />
          </span>
        </button>

        {items.slice(2).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`flex flex-col items-center gap-1 text-[0.68rem] uppercase tracking-[0.18em] ${
              activeId === item.id ? 'text-white' : 'text-white/58'
            }`}
          >
            <span className={activeId === item.id ? 'text-[#ff7b7b]' : 'text-white/76'}>{item.icon}</span>
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
      className="w-full overflow-hidden rounded-[24px] border border-[#8c2b2b] bg-black/20 text-left shadow-[0_18px_40px_rgba(0,0,0,0.3)] transition hover:border-[#dc5d5d]"
    >
      <div className="grid grid-cols-[42%,1fr]">
        <div className="relative min-h-[9.5rem]">
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
              <p className="text-xl font-semibold text-white">
                {venue.venue_name}
              </p>
              <p className="mt-1 text-sm text-white/55">
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
                className="rounded-full border border-white/12 bg-black/24 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60"
              >
                Save
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-base font-medium text-[#ffcf9f]">
            {venue.energy_level || "Lively social spot"}
          </p>
          <p className="mt-1 text-sm leading-6 text-white/72">
            {getVenueDescription(venue)}
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-[#ffb45d]">
            <span className={`inline-block h-2 w-2 rounded-full ${
              venue.is_open_now ? 'bg-[#4ade80]' : 'bg-[#ff9f4f]'
            }`} />
            {getVenueStatus(venue, index)}
          </p>
        </div>
      </div>
    </button>
  );
}
