import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/redeem-offer
 * Proxies to genie/redeem_offer
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const externalUserId = String(body.external_user_id ?? "").trim();
    const offerId = Number(body.offer_id);

    if (!externalUserId || !Number.isFinite(offerId)) {
      return NextResponse.json(
        { error: "external_user_id and offer_id are required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/redeem_offer", {
      method: "POST",
      body: {
        external_user_id: externalUserId,
        offer_id: offerId,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Could not redeem offer." },
      { status: 500 }
    );
  }
}
