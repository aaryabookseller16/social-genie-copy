import { NextRequest, NextResponse } from "next/server";
import {
  extractBearerToken,
  xanoFetch,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/vendor/review-offer
 * Body: { offer_id (required), decision ("approve"|"reject", required), rejection_reason? }
 * The caller must own the offer's venue.
 * Proxies to: genie/ep_review_influencer_offer_dev
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

    const offerId = Number(body.offer_id);
    const decision = String(body.decision ?? "").trim();

    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json(
        { error: "offer_id is required" },
        { status: 400 }
      );
    }
    if (
      decision !== "approve" &&
      decision !== "reject" &&
      decision !== "cancel"
    ) {
      return NextResponse.json(
        { error: "decision must be 'approve', 'reject' or 'cancel'" },
        { status: 400 }
      );
    }

    const raw = await xanoFetch<{
      success?: boolean;
      error?: string;
      code?: number;
      offer_id?: number;
      status?: string;
      reviewed_at?: string | number;
    }>("genie/ep_review_influencer_offer_dev", {
      method: "POST",
      authToken,
      body: {
        offer_id: offerId,
        decision,
        rejection_reason:
          decision === "reject" || decision === "cancel"
            ? String(body.rejection_reason ?? "").trim() || undefined
            : undefined,
      },
    });

    if (raw.success === false) {
      return NextResponse.json(
        { error: raw.error ?? "Could not review offer." },
        { status: raw.code === 403 ? 403 : 400 }
      );
    }

    return NextResponse.json(raw);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message, body: error.body },
        { status: error.status }
      );
    }
    console.error("POST /api/vendor/review-offer failed:", error);
    return NextResponse.json(
      { error: "Could not review offer." },
      { status: 500 }
    );
  }
}
