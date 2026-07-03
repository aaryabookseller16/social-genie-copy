/**
 * /app/i/[handle]/page.tsx
 * Influencer landing page — public, no auth gate.
 * Shares the same visual theme as the rest of the app (texture bg, max-w-md
 * phone-frame column, dark-mode glass cards, red ActionButton CTAs).
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { xanoFetch } from "@/app/lib/server/xanoProxy";
import { ScrollUnlock } from "./ScrollUnlock";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InfluencerProfile {
  id: number;
  handle: string;
  display_name: string;
  bio?: string;
  profile_image_url?: string | null;
  instagram_handle?: string;
  tiktok_handle?: string;
  content_niche?: string;
  tier?: string;
  is_verified?: boolean;
  vibes_score?: number;
}

interface InfluencerOffer {
  id: number;
  offer_type: string;
  offer_title: string;
  offer_description?: string;
  promo_code?: string;
  discount_value?: number | string;
  discount_type?: string;
  max_redemptions?: number;
  redemption_count?: number;
  status: string;
  expires_at?: number;
}

interface FeaturedVenue {
  id: number;
  venue_name: string;
  address?: string;
  area_neighborhood?: string;
  google_rating?: number;
  social_energy_state?: string;
  image_primary_url?: string;
  image_fallback_url?: string;
}

interface LandingPageResponse {
  success: boolean;
  profile: InfluencerProfile;
  offers: InfluencerOffer[];
  featured_venues: FeaturedVenue[];
  referral_url: string;
  landing_url: string;
  meta: { page_title: string; page_description?: string };
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function loadLandingPage(handle: string): Promise<LandingPageResponse | null> {
  try {
    const res = await xanoFetch<LandingPageResponse>(
      "genie/ep_get_influencer_landing_page_dev",
      { params: { handle } }
    );
    return res.success ? res : null;
  } catch { return null; }
}

async function loadInfluencerOffers(handle: string): Promise<InfluencerOffer[]> {
  try {
    const res = await xanoFetch<{ offers?: InfluencerOffer[]; success?: boolean }>(
      "genie/ep_get_influencer_offers_dev",
      { params: { handle } }
    );
    return res.offers ?? [];
  } catch { return []; }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const data = await loadLandingPage(handle);
  if (!data) return { title: "Social Bevy" };

  const { profile, meta } = data;
  const title = meta.page_title || `${profile.display_name} | Social Bevy`;
  const description =
    meta.page_description?.trim() ||
    profile.bio?.trim() ||
    `${profile.display_name} is sharing exclusive Social Bevy offers with you.`;

  return {
    title,
    description,
    openGraph: { title, description, siteName: "Genie - Social Bevy", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNicheLabel(niche?: string) {
  const map: Record<string, string> = {
    food: "Food & Dining", nightlife: "Nightlife", lifestyle: "Lifestyle",
    travel: "Travel", fitness: "Fitness", general: "Social Experiences",
  };
  return niche?.trim() ? (map[niche.trim()] ?? niche.trim()) : "Social Experiences";
}

function formatOfferType(type: string) {
  return type.trim().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InfluencerLandingPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const [data, dedicatedOffers] = await Promise.all([
    loadLandingPage(handle),
    loadInfluencerOffers(handle),
  ]);

  // 404 — same theme as the rest of the app
  if (!data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat px-6 text-center dark:bg-[url('/bg.png')]">
        <ScrollUnlock />
        <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/50 dark:block" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Page not found</h1>
          <p className="mt-2 text-gray-500 dark:text-white/55">
            This influencer page does not exist or has been removed.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-[18px] border border-red-500 bg-red-600 px-6 py-3 text-sm font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
          >
            Explore Social Bevy
          </Link>
        </div>
      </main>
    );
  }

  const { profile, offers: landingOffers, featured_venues, referral_url } = data;
  const offers = dedicatedOffers.length > 0 ? dedicatedOffers : landingOffers;
  const firstOffer = offers[0] ?? null;
  const acquisitionLink = firstOffer ? `/?ref=${handle}&offer=${firstOffer.id}` : referral_url;
  const existingUserLink = `/?screen=offers&ref=${handle}`;
  const firstName = profile.display_name.split(" ")[0];

  return (
    // Same texture background as every other screen
    <main className="min-h-dvh bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat dark:bg-[url('/bg.png')]">
      <ScrollUnlock />

      {/* Dark overlay — matches SinglePageGenieApp */}
      <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/50 dark:block" />

      {/* ── PHONE-FRAME COLUMN — same max-w-md as every other screen ── */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-8 pt-3">

        {/* ── BACK ARROW ────────────────────────────────────────────── */}
        <div className="flex items-center">
          <Link
            href="/"
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center text-gray-600 dark:text-white/82"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
            </svg>
          </Link>
        </div>

        {/* ── PROFILE CARD — avatar + name + bio + socials ──────────── */}
        <div className="rounded-[22px] border border-gray-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {profile.profile_image_url ? (
              <div className="relative h-16 w-16 flex-none overflow-hidden rounded-full border-2 border-red-400 shadow-[0_0_16px_rgba(220,38,38,0.35)]">
                <Image
                  src={profile.profile_image_url}
                  alt={profile.display_name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
            ) : (
              <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full border-2 border-red-400 bg-red-600 text-xl font-bold text-white shadow-[0_0_16px_rgba(220,38,38,0.35)]">
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Name + niche */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-[1.25rem] font-bold leading-tight text-gray-900 dark:text-white">
                  {profile.display_name}
                </h1>
                {profile.is_verified ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-red-500" fill="currentColor">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  </svg>
                ) : null}
              </div>
              {profile.content_niche?.trim() ? (
                <p className="mt-0.5 text-[0.75rem] font-medium text-red-500 dark:text-[#ff7b7b]">
                  {getNicheLabel(profile.content_niche)}
                </p>
              ) : null}
              <p className="mt-0.5 text-[0.72rem] text-gray-400 dark:text-white/40">
                @{profile.handle}
              </p>
            </div>
          </div>

          {/* Bio */}
          {profile.bio?.trim() ? (
            <p className="mt-3 text-[0.85rem] leading-6 text-gray-600 dark:text-white/70">
              {profile.bio.trim()}
            </p>
          ) : null}

          {/* Social links */}
          {(profile.instagram_handle || profile.tiktok_handle) ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {profile.instagram_handle ? (
                <a
                  href={`https://instagram.com/${profile.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[0.75rem] font-medium text-gray-600 transition hover:border-red-300 hover:text-red-600 dark:border-white/15 dark:bg-white/8 dark:text-white/70 dark:hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                  @{profile.instagram_handle}
                </a>
              ) : null}
              {profile.tiktok_handle ? (
                <a
                  href={`https://tiktok.com/@${profile.tiktok_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[0.75rem] font-medium text-gray-600 transition hover:border-red-300 hover:text-red-600 dark:border-white/15 dark:bg-white/8 dark:text-white/70 dark:hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.53V6.77a4.85 4.85 0 01-1-.08z" />
                  </svg>
                  @{profile.tiktok_handle}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ── EXCLUSIVE OFFERS ──────────────────────────────────────── */}
        {offers.length > 0 ? (
          <div className="space-y-3">
            <p className="px-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
              {firstName}&apos;s Exclusive Offers
            </p>

            {offers.map((offer) => (
              <div
                key={offer.id}
                className="rounded-[20px] border border-gray-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="mb-2 inline-block rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[0.68rem] font-semibold text-red-600 dark:border-white/10 dark:bg-black/20 dark:text-white/70">
                      {formatOfferType(offer.offer_type)}
                    </span>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {offer.offer_title}
                    </h3>
                    {offer.offer_description ? (
                      <p className="mt-1 text-[0.82rem] text-gray-500 dark:text-white/60">
                        {offer.offer_description}
                      </p>
                    ) : null}
                    {offer.promo_code?.trim() ? (
                      <div className="mt-2 inline-flex items-center rounded-[10px] border border-dashed border-red-300 bg-red-50 px-3 py-1.5 dark:border-white/20 dark:bg-white/5">
                        <span className="text-[0.72rem] font-bold uppercase tracking-wider text-red-600 dark:text-white/85">
                          {offer.promo_code.trim()}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {offer.discount_value ? (
                    <div className="flex-none text-right">
                      <span className="text-[1.4rem] font-black text-red-600 dark:text-[#ff7b7b]">
                        {offer.discount_type === "percent"
                          ? `${offer.discount_value}%`
                          : `$${offer.discount_value}`}
                      </span>
                      <p className="text-[0.65rem] text-gray-400 dark:text-white/40">OFF</p>
                    </div>
                  ) : null}
                </div>

                {(offer.redemption_count ?? 0) > 0 ? (
                  <p className="mt-2 text-[0.72rem] text-gray-400 dark:text-white/40">
                    {offer.redemption_count} people have claimed this offer
                  </p>
                ) : null}

                {offer.promo_code?.trim() ? (
                  <Link
                    href={`/i/${handle}/${encodeURIComponent(offer.promo_code.trim())}`}
                    className="mt-3 block w-full rounded-[18px] border border-red-500 bg-red-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-red-700 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                  >
                    Redeem This Offer
                  </Link>
                ) : (
                  <a
                    href={acquisitionLink}
                    className="mt-3 block w-full rounded-[18px] border border-red-500 bg-red-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-red-700 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                  >
                    Get This Offer — Download Social Bevy
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* ── FAVOURITE SPOTS ───────────────────────────────────────── */}
        {featured_venues.length > 0 ? (
          <div className="space-y-3">
            <p className="px-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
              {firstName}&apos;s Favourite Spots
            </p>

            <div className="grid grid-cols-2 gap-3">
              {featured_venues.map((venue) => (
                <a
                  key={venue.id}
                  href={`/venue/${venue.id}?ref=${handle}`}
                  className="overflow-hidden rounded-[18px] border border-gray-100 bg-white/90 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-black/25"
                >
                  <div className="relative h-24 w-full">
                    <Image
                      src={venue.image_primary_url || venue.image_fallback_url || "/sample-venue-1.jpeg"}
                      alt={venue.venue_name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 448px) 44vw, 200px"
                    />
                    {venue.social_energy_state ? (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[0.58rem] font-semibold text-white backdrop-blur-sm">
                        {venue.social_energy_state}
                      </span>
                    ) : null}
                  </div>
                  <div className="px-3 py-2">
                    <p className="line-clamp-1 text-[0.82rem] font-semibold text-gray-900 dark:text-white">
                      {venue.venue_name}
                    </p>
                    {venue.area_neighborhood ? (
                      <p className="mt-0.5 text-[0.7rem] text-gray-400 dark:text-white/45">
                        {venue.area_neighborhood}
                      </p>
                    ) : null}
                    {venue.google_rating ? (
                      <p className="mt-1 text-[0.7rem] font-medium text-amber-500">
                        ★ {venue.google_rating.toFixed(1)}
                      </p>
                    ) : null}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── GENIE ACQUISITION CARD ────────────────────────────────── */}
        <div className="rounded-[20px] border border-gray-100 bg-white/90 p-5 text-center shadow-sm dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-sm">
          <p className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-red-500 dark:text-[#ff7b7b]">
            Powered by Genie
          </p>
          <h3 className="text-[1rem] font-bold text-gray-900 dark:text-white">
            Discover more spots in Houston
          </h3>
          <p className="mt-1 text-[0.82rem] leading-5 text-gray-500 dark:text-white/55">
            Genie finds the best experiences tailored to your vibe.
          </p>
          <a
            href={acquisitionLink}
            className="mt-4 block w-full rounded-[18px] border border-red-500 bg-red-600 py-3.5 text-sm font-semibold text-white transition hover:bg-red-700 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))] dark:shadow-[0_0_0_1px_rgba(255,120,120,0.08),0_18px_36px_rgba(0,0,0,0.28)]"
          >
            Try Genie Free
          </a>
          <a
            href={existingUserLink}
            className="mt-2 block w-full rounded-[18px] border border-gray-200 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5"
          >
            Already have Social Bevy? Open App
          </a>
        </div>

        {/* bottom padding for sticky CTA */}
        {firstOffer ? <div className="h-16" /> : null}
      </div>

      {/* ── STICKY CTA — constrained to max-w-md like everything else ── */}
      {firstOffer ? (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-white/95 px-4 pb-6 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:bg-black/80 dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
          <div className="mx-auto max-w-md">
            <a
              href={acquisitionLink}
              className="block w-full rounded-[18px] border border-red-500 bg-red-600 py-4 text-center font-semibold text-white shadow-[0_8px_24px_rgba(220,38,38,0.35)] dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
            >
              Get {firstName}&apos;s Offer Free
            </a>
            <p className="mt-1.5 text-center text-[0.72rem] text-gray-400 dark:text-white/40">
              Download Social Bevy to claim this offer
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
