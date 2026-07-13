import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  toClientError,
} from "@/app/lib/server/xanoProxy";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * POST /api/genie/create-influencer-offer
 * Body: { offer_title (required), offer_type (required),
 *         venue_id / event_id (exactly one required),
 *         offer_description?, discount_value?, promo_code?, max_redemptions?, expires_at? }
 * Proxies to: genie/ep_create_influencer_offer_dev
 *
 * The offer is created with status "pending" until the venue owner (vendor)
 * or event owner (producer) approves it.
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
    const offerDescription = String(body.offer_description ?? "").trim();
    const venueId = Number(body.venue_id);
    const eventId = Number(body.event_id);
    const hasVenue = Number.isFinite(venueId) && venueId > 0;
    const hasEvent = Number.isFinite(eventId) && eventId > 0;

    if (!offerTitle) {
      return NextResponse.json(
        { error: "offer_title is required" },
        { status: 400 }
      );
    }
    if (offerTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `offer_title must be ${MAX_TITLE_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }
    if (offerDescription.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        {
          error: `offer_description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`,
        },
        { status: 400 }
      );
    }
    if (!offerType) {
      return NextResponse.json(
        { error: "offer_type is required" },
        { status: 400 }
      );
    }
    if (hasVenue === hasEvent) {
      return NextResponse.json(
        { error: "Provide exactly one of venue_id or event_id" },
        { status: 400 }
      );
    }

    const maxRedemptions = Number(body.max_redemptions);
    const discountValue = Number(body.discount_value);
    if (body.max_redemptions !== undefined && (!Number.isFinite(maxRedemptions) || maxRedemptions <= 0)) {
      return NextResponse.json(
        { error: "max_redemptions must be a positive number" },
        { status: 400 }
      );
    }
    if (body.discount_value !== undefined && (!Number.isFinite(discountValue) || discountValue < 0)) {
      return NextResponse.json(
        { error: "discount_value must be a non-negative number" },
        { status: 400 }
      );
    }

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
        venue_id: hasVenue ? venueId : undefined,
        event_id: hasEvent ? eventId : undefined,
        offer_description: offerDescription || undefined,
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
    const { status, message } = toClientError(error, "Could not create offer.");
    return NextResponse.json({ error: message }, { status });
  }
}
