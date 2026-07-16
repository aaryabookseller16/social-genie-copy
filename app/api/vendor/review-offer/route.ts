import { NextRequest, NextResponse } from "next/server";
import {
  extractBearerToken,
  toClientError,
  xanoFetch,
} from "@/app/lib/server/xanoProxy";

const MAX_REASON_LENGTH = 500;

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

    const rejectionReason = String(body.rejection_reason ?? "").trim();
    if (rejectionReason.length > MAX_REASON_LENGTH) {
      return NextResponse.json(
        { error: `rejection_reason must be ${MAX_REASON_LENGTH} characters or fewer` },
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
            ? rejectionReason || undefined
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
    const { status, message } = toClientError(error, "Could not review offer.");
    return NextResponse.json({ error: message }, { status });
  }
}
