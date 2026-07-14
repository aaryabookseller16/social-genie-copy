"use client";

/**
 * Client-side redeem UI for an influencer offer. Matches the influencer landing
 * page theme (texture bg, max-w-md column, dark glass cards, red CTAs).
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { readAuthToken } from "@/app/lib/localState";
import {
  redeemInfluencerOffer,
  type InfluencerOffer,
} from "@/app/lib/publicApiClient";
import { ScrollUnlock } from "../ScrollUnlock";
import ImageGallery from "@/app/components/ImageGallery";
import FeaturedEventVideos from "@/app/components/FeaturedEventVideos";
import { galleryFor } from "@/app/lib/image";

type OfferProp = InfluencerOffer;

interface RedeemResult {
  redemption_id?: number;
  offer_title?: string;
  offer_type?: string;
  discount_value?: number | string;
  discount_type?: string;
  influencer_name?: string;
  message?: string;
}

function formatOfferType(type: string) {
  return type.trim().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDiscount(value?: number | string, type?: string) {
  if (value === undefined || value === null || `${value}`.trim() === "") return null;
  return type === "percent" ? `${value}%` : `$${value}`;
}

export function RedeemClient({
  offer,
  handle,
  code,
}: {
  offer: OfferProp;
  handle: string;
  code: string;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RedeemResult | null>(null);

  useEffect(() => {
    setIsLoggedIn(readAuthToken() !== null);
  }, []);

  async function handleRedeem() {
    setIsRedeeming(true);
    setError(null);
    try {
      const res = await redeemInfluencerOffer(code);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not redeem this offer.");
    } finally {
      setIsRedeeming(false);
    }
  }

  const discount = formatDiscount(offer.discount_value, offer.discount_type);
  const confirmedDiscount = result
    ? formatDiscount(result.discount_value, result.discount_type)
    : null;
  const offerImages = galleryFor(offer.image_urls?.[0], offer.image_urls);

  return (
    <main className="min-h-dvh bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat dark:bg-[url('/bg.png')]">
      <ScrollUnlock />
      <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/50 dark:block" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 px-4 pb-10 pt-3">
        {/* Back to the influencer page */}
        <div className="flex items-center">
          <Link
            href={`/i/${handle}`}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center text-gray-600 dark:text-white/82"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
            </svg>
          </Link>
        </div>

        {offerImages.length > 0 ? (
          <div className="-mx-4 overflow-hidden">
            <ImageGallery images={offerImages} alt={offer.offer_title} heightClass="h-56" />
          </div>
        ) : null}

        {result ? (
          /* ── CONFIRMATION ─────────────────────────────────────────── */
          <div className="mt-6 rounded-[22px] border border-green-200 bg-white/90 p-6 text-center shadow-sm dark:border-green-500/30 dark:bg-black/25 dark:backdrop-blur-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
              <svg viewBox="0 0 24 24" className="h-9 w-9 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="mt-4 text-[1.35rem] font-bold text-gray-900 dark:text-white">
              Offer Redeemed
            </h1>
            <p className="mt-1 text-[0.95rem] font-semibold text-gray-800 dark:text-white/90">
              {result.offer_title ?? offer.offer_title}
            </p>
            {confirmedDiscount ?? discount ? (
              <p className="mt-1 text-[1.6rem] font-black text-red-600 dark:text-[#ff7b7b]">
                {confirmedDiscount ?? discount} OFF
              </p>
            ) : null}
            {result.influencer_name ? (
              <p className="mt-2 text-[0.82rem] text-gray-500 dark:text-white/55">
                Shared by {result.influencer_name}
              </p>
            ) : null}
            {result.redemption_id !== undefined ? (
              <div className="mt-4 inline-flex items-center rounded-[12px] border border-dashed border-red-300 bg-red-50 px-4 py-2 dark:border-white/20 dark:bg-white/5">
                <span className="text-[0.85rem] font-bold uppercase tracking-wider text-red-600 dark:text-white/85">
                  Ref# {result.redemption_id}
                </span>
              </div>
            ) : null}
            <p className="mt-5 text-[0.85rem] font-medium text-gray-600 dark:text-white/70">
              Show this screen to staff.
            </p>
          </div>
        ) : (
          /* ── OFFER + REDEEM ───────────────────────────────────────── */
          <>
            <div className="rounded-[22px] border border-gray-100 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="mb-2 inline-block rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[0.68rem] font-semibold text-red-600 dark:border-white/10 dark:bg-black/20 dark:text-white/70">
                    {formatOfferType(offer.offer_type)}
                  </span>
                  <h1 className="text-[1.15rem] font-bold text-gray-900 dark:text-white">
                    {offer.offer_title}
                  </h1>
                  {offer.offer_description ? (
                    <p className="mt-1 text-[0.85rem] text-gray-500 dark:text-white/60">
                      {offer.offer_description}
                    </p>
                  ) : null}
                  {offer.event_id && offer.event_title ? (
                    <p className="mt-1 text-[0.78rem] font-medium text-gray-500 dark:text-white/50">
                      For {offer.event_title}
                      {offer.event_date ? ` · ${offer.event_date}` : ""}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[0.72rem] text-gray-400 dark:text-white/40">
                    Shared by @{handle}
                  </p>
                </div>
                {discount ? (
                  <div className="flex-none text-right">
                    <span className="text-[1.5rem] font-black text-red-600 dark:text-[#ff7b7b]">
                      {discount}
                    </span>
                    <p className="text-[0.65rem] text-gray-400 dark:text-white/40">OFF</p>
                  </div>
                ) : null}
              </div>

              {offer.promo_code?.trim() ? (
                <div className="mt-3 inline-flex items-center rounded-[10px] border border-dashed border-red-300 bg-red-50 px-3 py-1.5 dark:border-white/20 dark:bg-white/5">
                  <span className="text-[0.72rem] font-bold uppercase tracking-wider text-red-600 dark:text-white/85">
                    {offer.promo_code.trim()}
                  </span>
                </div>
              ) : null}
            </div>

            <FeaturedEventVideos
              videos={offer.video_urls}
              eventTitle={offer.offer_title}
              headingClassName="text-gray-900 dark:text-white"
            />

            {error ? (
              <p className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[0.85rem] font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            ) : null}

            {isLoggedIn ? (
              <button
                type="button"
                onClick={handleRedeem}
                disabled={isRedeeming}
                className="mt-1 flex w-full items-center justify-center rounded-[18px] border border-red-500 bg-red-600 py-4 text-center text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
              >
                {isRedeeming ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  "Redeem This Offer"
                )}
              </button>
            ) : (
              <>
                <Link
                  href="/?screen=account"
                  className="mt-1 block w-full rounded-[18px] border border-red-500 bg-red-600 py-4 text-center text-sm font-semibold text-white transition hover:bg-red-700 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                >
                  Log In / Sign Up to Redeem
                </Link>
                <p className="text-center text-[0.72rem] text-gray-400 dark:text-white/40">
                  After signing in, reopen this link to redeem.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
