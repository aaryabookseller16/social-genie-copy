import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/redeem-influencer-offer
 * Body: { promo_code (required) }
 * Redeems an influencer offer so the influencer's commission is credited.
 * The redeeming user is resolved from the JWT ($auth.id) on Xano.
 * Proxies to: genie/ep_redeem_influencer_offer_dev
 *
 * Business failures (already redeemed, max reached, invalid/expired) come back
 * from Xano as { success: false, error } with a 200 — returned as-is so the
 * client can surface `error`.
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

    const promoCode = String(body.promo_code ?? "").trim();
    if (!promoCode) {
      return NextResponse.json(
        { error: "promo_code is required" },
        { status: 400 }
      );
    }

    const raw = await xanoFetch("genie/ep_redeem_influencer_offer_dev", {
      method: "POST",
      authToken,
      body: { promo_code: promoCode },
    });

    return NextResponse.json(raw);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/genie/redeem-influencer-offer failed:", error);
    return NextResponse.json(
      { error: "Could not redeem this offer." },
      { status: 500 }
    );
  }
}
