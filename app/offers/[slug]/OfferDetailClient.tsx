"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { type OfferDetailResponse } from "@/app/offers/[slug]/page";

const OFFER_TYPE_LABELS: Record<string, string> = {
  happy_hour: "Happy Hour",
  perk: "Perk",
  brunch: "Brunch",
  late_night: "Late Night",
  discount: "Discount",
};

export function OfferDetailClient({
  data,
  slug,
}: {
  data: OfferDetailResponse;
  slug: string;
}) {
  const { offer, venue, event, influencer } = data;

  // globals.css sets body { overflow: hidden; height: 100dvh } for the SPA
  // shell — this is a standalone public page, same fix as VenueDetailClient
  // and PostDetailClient.
  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);

  const [copied, setCopied] = useState(false);
  const code = offer.promo_code || offer.unique_code;

  const handleCopyCode = useCallback(async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleShare = useCallback(async () => {
    const url = `https://socialbevy.com/offers/${slug}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: offer.offer_title, url });
      } catch {
        // User cancelled share — no-op
      }
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    }
  }, [slug, offer.offer_title]);

  const label = OFFER_TYPE_LABELS[offer.offer_type] || offer.offer_type?.replaceAll("_", " ");
  const heroImage = offer.image_urls?.[0] || venue?.image_primary_url || null;

  return (
    <main className="min-h-dvh bg-[#1a0505] pb-12">
      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#1a0505]/95 px-4 py-3 backdrop-blur-sm">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          aria-label="Back to Social Bevy"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <button
          type="button"
          onClick={() => void handleShare()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          aria-label="Share"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
            <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
          </svg>
        </button>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4">
        {heroImage ? (
          <div className="relative h-44 w-full overflow-hidden rounded-[20px]">
            <Image src={heroImage} alt={offer.offer_title} fill className="object-cover" sizes="(max-width: 448px) 100vw, 448px" priority />
          </div>
        ) : null}

        <div className="mt-4 flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-[1.4rem] font-bold leading-tight text-white">
            {offer.offer_title}
          </h1>
          {label ? (
            <span className="flex-none rounded-full bg-[#e8900a] px-3 py-1 text-[0.72rem] font-bold uppercase tracking-wide text-white">
              {label}
            </span>
          ) : null}
        </div>

        {offer.discount_value ? (
          <p className="mt-1 text-[1.1rem] font-bold text-[#ff9d7d]">
            {offer.discount_value}% off
          </p>
        ) : null}

        {offer.offer_description ? (
          <p className="mt-3 text-[0.9rem] leading-6 text-white/75">{offer.offer_description}</p>
        ) : null}

        {code ? (
          <button
            type="button"
            onClick={() => void handleCopyCode()}
            className="mt-5 flex w-full items-center justify-between rounded-[16px] border border-dashed border-[#E7070380] bg-black/30 px-4 py-3.5 text-left"
          >
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/55">
                Promo Code
              </p>
              <p className="mt-0.5 text-[1.05rem] font-bold tracking-wide text-white">{code}</p>
            </div>
            <span className="rounded-full bg-red-600 px-3 py-1.5 text-[0.78rem] font-semibold text-white">
              {copied ? "Copied!" : "Copy"}
            </span>
          </button>
        ) : null}

        {venue ? (
          <Link
            href={`/venue/${venue.id}`}
            className="mt-5 flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/25 p-3"
          >
            {venue.image_primary_url ? (
              <div className="relative h-14 w-14 flex-none overflow-hidden rounded-xl">
                <Image src={venue.image_primary_url} alt={venue.venue_name ?? ""} fill className="object-cover" sizes="56px" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.95rem] font-semibold text-white">{venue.venue_name}</p>
              {venue.area_neighborhood ? (
                <p className="truncate text-[0.78rem] text-white/55">{venue.area_neighborhood}</p>
              ) : null}
            </div>
            <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-white/40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ) : event ? (
          <Link
            href={event.public_slug ? `/events/${event.public_slug}` : "#"}
            className="mt-5 flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/25 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.95rem] font-semibold text-white">{event.title}</p>
              {event.event_date ? (
                <p className="truncate text-[0.78rem] text-white/55">
                  {new Date(event.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              ) : null}
            </div>
          </Link>
        ) : null}

        {influencer?.name ? (
          <p className="mt-4 text-center text-[0.78rem] text-white/40">
            Offer by {influencer.name}
            {influencer.handle ? ` (@${influencer.handle})` : ""}
          </p>
        ) : null}
      </div>
    </main>
  );
}
