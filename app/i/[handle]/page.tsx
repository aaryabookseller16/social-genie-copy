/**
 * /app/i/[handle]/page.tsx
 *
 * INFLUENCER LANDING PAGE
 * Route: socialbevy.com/i/{handle}
 *
 * Every influencer gets a personal landing page at this URL.
 * This is the link they share on TikTok, Instagram, and everywhere else.
 *
 * Two paths for the visitor:
 *   - New user: "Get This Offer — Download Social Bevy"
 *     Deep link carries influencer_id + offer_id → auto-applies offer on signup
 *   - Existing user: "Already have Social Bevy? Open App"
 *     Deep link opens the app to the offer screen
 *
 * Vendor acquisition via influencer:
 *   When this page surfaces a venue NOT yet on Social Bevy,
 *   the system triggers automated vendor outreach (handled by Xano backend).
 *   Frontend just renders — acquisition happens server-side.
 *
 * Data source: ep_get_influencer_landing_page_dev (Xano v1.5-dev)
 */
 
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { xanoFetch } from "@/app/lib/server/xanoProxy";
 
// ─── Types ───────────────────────────────────────────────────────────────────
 
interface InfluencerProfile {
  id: number;
  handle: string;
  display_name: string;
  bio?: string;
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
  discount_value?: number;
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
  social_energy_score?: number;
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
  meta: {
    page_title: string;
    page_description?: string;
  };
}
 
// ─── Server data fetching ─────────────────────────────────────────────────────
 
async function loadLandingPage(handle: string): Promise<LandingPageResponse | null> {
  try {
    const response = await xanoFetch<LandingPageResponse>(
      "genie/ep_get_influencer_landing_page_dev",
      { params: { handle } }
    );
    return response.success ? response : null;
  } catch {
    return null;
  }
}
 
// ─── SEO Metadata ─────────────────────────────────────────────────────────────
 
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const data = await loadLandingPage(handle);
 
  if (!data) {
    return { title: "Social Bevy" };
  }
 
  const { profile, meta } = data;
  const title = meta.page_title || `${profile.display_name} | Social Bevy`;
  const description =
    meta.page_description ||
    profile.bio ||
    `${profile.display_name} is sharing exclusive Social Bevy offers with you.`;
 
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Social Bevy",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
 
// ─── Helpers ─────────────────────────────────────────────────────────────────
 
function getNicheLabel(niche?: string): string {
  const labels: Record<string, string> = {
    food: "Food & Dining",
    nightlife: "Nightlife",
    lifestyle: "Lifestyle",
    travel: "Travel",
    fitness: "Fitness",
    general: "Social Experiences",
  };
  return niche ? (labels[niche] || niche) : "Social Experiences";
}
 
function formatOfferType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
 
// ─── Page ─────────────────────────────────────────────────────────────────────
 
export default async function InfluencerLandingPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const data = await loadLandingPage(handle);
 
  // 404 fallback
  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-gray-500">
          This influencer page does not exist or has been removed.
        </p>
        <Link href="/" className="mt-6 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white">
          Explore Social Bevy
        </Link>
      </main>
    );
  }
 
  const { profile, offers, featured_venues, referral_url } = data;
 
  // Deep link for new user acquisition
  // Carries handle + first offer id so the app auto-applies on signup
  const firstOffer = offers[0] ?? null;
  const acquisitionLink = firstOffer
    ? `https://genie.socialbevy.com?ref=${handle}&offer=${firstOffer.id}`
    : referral_url;
 
  // Deep link for existing users — opens app to offer screen
  const existingUserLink = `https://genie.socialbevy.com?screen=offers&ref=${handle}`;
 
  return (
    <main className="min-h-screen bg-white">
 
      {/* ── HEADER ───────────────────────────────────────────────────── */}
      <header className="border-b border-gray-100 px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/socialbevylogo.png"
              alt="Social Bevy"
              width={120}
              height={32}
              className="h-8 w-auto object-contain"
            />
          </Link>
          <a href={acquisitionLink} className="rounded-full bg-red-600 px-4 py-2 text-[0.8rem] font-semibold text-white">
            Get the App
          </a>
        </div>
      </header>
 
      <div className="mx-auto max-w-2xl px-5 pb-32 pt-8 space-y-8">
 
        {/* ── INFLUENCER PROFILE SECTION ──────────────────────────────── */}
        <div className="text-center">
          {/* Avatar placeholder — uses initials when no image */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-2xl font-bold text-white shadow-lg">
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
 
          <h1 className="text-[1.6rem] font-bold text-gray-900">
            {profile.display_name}
          </h1>
 
          {/* Verified badge */}
          {profile.is_verified ? (
            <div className="mt-1 inline-flex items-center gap-1 text-[0.78rem] font-medium text-red-600">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
              Verified Creator
            </div>
          ) : null}
 
          {/* Niche */}
          <p className="mt-1 text-[0.85rem] text-gray-500">
            {getNicheLabel(profile.content_niche)}
          </p>
 
          {/* Bio */}
          {profile.bio ? (
            <p className="mt-3 text-[0.9rem] leading-6 text-gray-700 max-w-sm mx-auto">
              {profile.bio}
            </p>
          ) : null}
 
          {/* Social handles */}
          <div className="mt-3 flex items-center justify-center gap-4">
            {profile.instagram_handle ? (
              <a href={`https://instagram.com/${profile.instagram_handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[0.82rem] font-medium text-gray-600 hover:text-red-600">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                @{profile.instagram_handle}
              </a>
            ) : null}
 
            {profile.tiktok_handle ? (
              <a href={`https://tiktok.com/@${profile.tiktok_handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[0.82rem] font-medium text-gray-600 hover:text-red-600">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.53V6.77a4.85 4.85 0 01-1-.08z" />
                </svg>
                @{profile.tiktok_handle}
              </a>
            ) : null}
          </div>
        </div>
 
        {/* ── OFFERS SECTION ───────────────────────────────────────────── */}
        {offers.length > 0 ? (
          <div>
            <h2 className="mb-4 text-[1.1rem] font-semibold text-gray-900">
              {profile.display_name.split(" ")[0]}&#39;s Exclusive Offers
            </h2>
 
            <div className="space-y-3">
              {offers.map((offer) => (
                <div key={offer.id} className="rounded-[20px] border border-gray-100 bg-gray-50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[0.68rem] font-semibold text-red-600 mb-2">
                        {formatOfferType(offer.offer_type)}
                      </span>
                      <h3 className="font-semibold text-gray-900">{offer.offer_title}</h3>
                      {offer.offer_description ? (
                        <p className="mt-1 text-[0.82rem] text-gray-600">{offer.offer_description}</p>
                      ) : null}
                      {offer.promo_code ? (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-[10px] border border-dashed border-red-300 bg-red-50 px-3 py-1.5">
                          <span className="text-[0.72rem] font-bold uppercase tracking-wider text-red-600">
                            {offer.promo_code}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {offer.discount_value ? (
                      <div className="flex-none text-right">
                        <span className="text-[1.4rem] font-black text-red-600">
                          {offer.discount_type === "percent"
                            ? `${offer.discount_value}%`
                            : `$${offer.discount_value}`}
                        </span>
                        <p className="text-[0.65rem] text-gray-400">OFF</p>
                      </div>
                    ) : null}
                  </div>
 
                  {/* Redemption count social proof */}
                  {(offer.redemption_count ?? 0) > 0 ? (
                    <p className="mt-2 text-[0.72rem] text-gray-400">
                      {offer.redemption_count} people have claimed this offer
                    </p>
                  ) : null}
 
                  {/* CTA */}
                  <a href={`${acquisitionLink}&offer=${offer.id}`} className="mt-3 block w-full rounded-[14px] bg-red-600 py-3 text-center text-sm font-semibold text-white hover:bg-red-700">
                    Get This Offer — Download Social Bevy
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : null}
 
        {/* ── FEATURED VENUES ──────────────────────────────────────────── */}
        {featured_venues.length > 0 ? (
          <div>
            <h2 className="mb-4 text-[1.1rem] font-semibold text-gray-900">
              {profile.display_name.split(" ")[0]}&#39;s Favorite Spots
            </h2>
 
            <div className="grid grid-cols-2 gap-3">
              {featured_venues.map((venue) => (
                <a key={venue.id} href={`https://genie.socialbevy.com/venue/${venue.id}?ref=${handle}`} className="overflow-hidden rounded-[16px] border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
                  <div className="relative h-28 w-full">
                    <Image
                      src={venue.image_primary_url || venue.image_fallback_url || "/sample-venue-1.jpeg"}
                      alt={venue.venue_name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 44vw, 200px"
                    />
                    {/* Social Energy overlay */}
                    {venue.social_energy_state ? (
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[0.6rem] font-semibold text-white backdrop-blur-sm">
                        {venue.social_energy_state}
                      </span>
                    ) : null}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="line-clamp-1 text-[0.85rem] font-semibold text-gray-900">
                      {venue.venue_name}
                    </p>
                    {venue.area_neighborhood ? (
                      <p className="mt-0.5 text-[0.72rem] text-gray-400">
                        {venue.area_neighborhood}
                      </p>
                    ) : null}
                    {venue.google_rating ? (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[0.8rem] text-yellow-400">★</span>
                        <span className="text-[0.72rem] font-medium text-gray-600">
                          {venue.google_rating.toFixed(1)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}
 
        {/* ── ABOUT SOCIAL BEVY ────────────────────────────────────────── */}
        <div className="rounded-[20px] bg-gray-900 p-6 text-center">
          <Image
            src="/icons/Social-Genie-Home-Screen.png"
            alt="Genie"
            width={64}
            height={64}
            className="mx-auto mb-4 h-16 w-16 object-contain"
          />
          <h3 className="text-[1.1rem] font-bold text-white">
            What is Social Bevy?
          </h3>
          <p className="mt-2 text-[0.85rem] leading-6 text-white/65">
            Social Bevy is your AI-powered social concierge for Houston.
            Genie finds the best experiences — happy hours, brunches, events,
            and hidden gems — tailored to your vibe.
          </p>
          <a href={acquisitionLink} className="mt-5 block w-full rounded-[16px] bg-red-600 py-4 text-sm font-semibold text-white hover:bg-red-700">
            Get the App — It&#39;s Free
          </a>
          <a href={existingUserLink} className="mt-2 block w-full rounded-[16px] border border-white/20 py-3 text-sm font-medium text-white/80 hover:bg-white/10">
            Already have Social Bevy? Open App
          </a>
        </div>
 
      </div>
 
      {/* ── STICKY CTA (mobile) ──────────────────────────────────────────── */}
      {firstOffer ? (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 px-4 pb-6 pt-3 backdrop-blur-sm shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-2xl">
            <a href={acquisitionLink} className="block w-full rounded-[18px] bg-red-600 py-4 text-center font-semibold text-white shadow-[0_8px_24px_rgba(220,38,38,0.35)]">
              Get {profile.display_name.split(" ")[0]}&#39;s Offer Free
            </a>
            <p className="mt-1.5 text-center text-[0.72rem] text-gray-400">
              Download Social Bevy to claim this offer
            </p>
          </div>
        </div>
      ) : null}
 
    </main>
  );
}
 