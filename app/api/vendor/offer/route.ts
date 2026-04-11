import { NextRequest, NextResponse } from "next/server";
import {
  extractBearerToken,
  xanoFetch,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/vendor/offer
 * Proxies to genie/vendor_create_offer
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const result = await xanoFetch<{
      success: boolean;
      offer_id: number;
    }>("genie/vendor_create_offer", {
      method: "POST",
      authToken,
      body: {
        vendor_id: body.vendor_id,
        title: body.title,
        description: body.description,
        offer_type: body.offer_type,
        discount_value: body.discount_value,
        redeem_instructions: body.redeem_instructions,
        link_url: body.link_url,
        redemption_limit: body.redemption_limit,
        vibee_only: body.vibee_only,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message, body: error.body },
        { status: error.status }
      );
    }
    console.error("POST /api/vendor/offer failed:", error);
    return NextResponse.json(
      { error: "Could not create vendor offer." },
      { status: 500 }
    );
  }
}
