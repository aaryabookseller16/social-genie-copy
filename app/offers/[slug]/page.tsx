import type { Metadata } from "next";
import Link from "next/link";

import { OfferDetailClient } from "@/app/offers/[slug]/OfferDetailClient";
import { xanoFetch } from "@/app/lib/server/xanoProxy";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OfferVenue {
  id: number;
  venue_name?: string;
  address?: string;
  area_neighborhood?: string;
  image_primary_url?: string;
  phone?: string;
  google_maps_url?: string;
}

export interface OfferEvent {
  id: number;
  title?: string;
  event_date?: string;
  public_slug?: string;
}

export interface OfferInfluencer {
  id: number;
  name?: string;
  handle?: string;
  image_url?: string;
  is_verified?: boolean;
}

export interface OfferDetail {
  id: number;
  offer_title: string;
  offer_description?: string;
  offer_type: string;
  discount_value?: string;
  discount_type?: string | null;
  promo_code?: string;
  unique_code?: string;
  unique_url_slug?: string;
  max_redemptions?: number;
  redemptions_used?: number;
  image_urls?: string[];
  video_urls?: { url: string; thumbnail_url?: string }[];
}

export interface OfferDetailResponse {
  success: boolean;
  offer: OfferDetail;
  venue: OfferVenue | null;
  event: OfferEvent | null;
  influencer: OfferInfluencer | null;
}

// ─── Server data fetching ─────────────────────────────────────────────────────

async function loadOfferBySlug(slug: string): Promise<OfferDetailResponse | null> {
  try {
    const response = await xanoFetch<OfferDetailResponse>(
      "genie/ep_get_offer_by_slug_dev",
      { params: { slug } }
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadOfferBySlug(slug);

  if (!data) {
    return { title: "Offer - Social Bevy" };
  }

  const { offer, venue } = data;
  const title = venue?.venue_name
    ? `${offer.offer_title} at ${venue.venue_name} - Social Bevy`
    : `${offer.offer_title} - Social Bevy`;
  const description =
    offer.offer_description?.slice(0, 155) ||
    [offer.offer_title, venue?.venue_name].filter(Boolean).join(" · ");
  const image =
    offer.image_urls?.[0] ||
    venue?.image_primary_url ||
    "https://socialbevy.com/images/socialbevylogo.png";
  const url = `https://socialbevy.com/offers/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Social Bevy",
      type: "website",
      images: [{ url: image, alt: offer.offer_title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadOfferBySlug(slug);

  if (!data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center dark:bg-transparent">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Offer not found</h1>
        <p className="mt-2 text-gray-500 dark:text-white/60">
          This offer may have expired or been removed.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white"
        >
          Discover more on Social Bevy
        </Link>
      </main>
    );
  }

  return <OfferDetailClient data={data} slug={slug} />;
}
