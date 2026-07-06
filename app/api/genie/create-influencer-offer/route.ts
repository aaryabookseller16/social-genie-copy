import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/create-influencer-offer
 * Body: { venue_id (required), offer_title (required), offer_type (required),
 *         offer_description?, discount_value?, promo_code?, max_redemptions?, expires_at? }
 * Proxies to: genie/ep_create_influencer_offer_dev
 *
 * The offer is created with status "pending" until the venue owner approves it.
 * (`discount_type` is intentionally not forwarded — the backend has no column.)
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);

    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const offerTitle = String(body.offer_title ?? "").trim();
    const offerType = String(body.offer_type ?? "").trim();
    const venueId = Number(body.venue_id);

    if (!offerTitle) {
      return NextResponse.json(
        { error: "offer_title is required" },
        { status: 400 }
      );
    }
    if (!offerType) {
      return NextResponse.json(
        { error: "offer_type is required" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(venueId) || venueId <= 0) {
      return NextResponse.json(
        { error: "A venue is required" },
        { status: 400 }
      );
    }

    const maxRedemptions = Number(body.max_redemptions);
    const discountValue = Number(body.discount_value);

    const raw = await xanoFetch<{
      success?: boolean;
      error?: string;
      offer_id?: number;
      status?: string;
      promo_code?: string;
      offer_type?: string;
      offer_title?: string;
      landing_url?: string;
    }>("genie/ep_create_influencer_offer_dev", {
      method: "POST",
      authToken,
      body: {
        offer_type: offerType,
        offer_title: offerTitle,
        venue_id: venueId,
        offer_description:
          String(body.offer_description ?? "").trim() || undefined,
        discount_value: Number.isFinite(discountValue)
          ? discountValue
          : undefined,
        promo_code: String(body.promo_code ?? "").trim() || undefined,
        max_redemptions: Number.isFinite(maxRedemptions)
          ? maxRedemptions
          : undefined,
        expires_at: String(body.expires_at ?? "").trim() || undefined,
      },
    });

    if (raw.success === false) {
      return NextResponse.json(
        { error: raw.error ?? "Could not create offer." },
        { status: 400 }
      );
    }

    return NextResponse.json(raw);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Could not create offer." },
      { status: 500 }
    );
  }
}
