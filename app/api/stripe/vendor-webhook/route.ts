import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/stripe/vendor-webhook
 *
 * Placeholder route mirroring the latest docs. In production the webhook is
 * handled by Xano/Stripe directly, not by the frontend app.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error:
        "This vendor webhook is Stripe-facing and should be handled by Xano directly.",
    },
    { status: 501 }
  );
}
