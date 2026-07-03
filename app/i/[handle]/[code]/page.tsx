/**
 * /app/i/[handle]/[code]/page.tsx
 * Influencer offer redeem page — public route; redemption itself requires auth.
 * Looks up the offer by promo_code for the given influencer handle, then hands
 * off to a client component that calls the influencer-specific redeem endpoint.
 */

import Link from "next/link";
import { xanoFetch } from "@/app/lib/server/xanoProxy";
import { ScrollUnlock } from "../ScrollUnlock";
import { RedeemClient } from "./RedeemClient";

interface InfluencerOffer {
  id: number;
  offer_type: string;
  offer_title: string;
  offer_description?: string;
  promo_code?: string;
  discount_value?: number | string;
  discount_type?: string;
  status: string;
}

async function loadInfluencerOffers(handle: string): Promise<InfluencerOffer[]> {
  try {
    const res = await xanoFetch<{ offers?: InfluencerOffer[]; success?: boolean }>(
      "genie/ep_get_influencer_offers_dev",
      { params: { handle } }
    );
    return res.offers ?? [];
  } catch {
    return [];
  }
}

export default async function RedeemOfferPage({
  params,
}: {
  params: Promise<{ handle: string; code: string }>;
}) {
  const { handle, code } = await params;
  const offers = await loadInfluencerOffers(handle);
  const wanted = decodeURIComponent(code).trim().toLowerCase();
  const offer = offers.find(
    (o) => o.promo_code?.trim().toLowerCase() === wanted
  );

  // 404 — same theme as the influencer landing page
  if (!offer) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat px-6 text-center dark:bg-[url('/bg.png')]">
        <ScrollUnlock />
        <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/50 dark:block" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Offer not found</h1>
          <p className="mt-2 text-gray-500 dark:text-white/55">
            This offer does not exist or is no longer available.
          </p>
          <Link
            href={`/i/${handle}`}
            className="mt-6 inline-block rounded-[18px] border border-red-500 bg-red-600 px-6 py-3 text-sm font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
          >
            Back to offers
          </Link>
        </div>
      </main>
    );
  }

  return <RedeemClient offer={offer} handle={handle} code={offer.promo_code!.trim()} />;
}
