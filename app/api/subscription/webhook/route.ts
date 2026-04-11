import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/subscription/webhook
 *
 * Placeholder route. In production, Stripe webhook events are handled
 * by Xano directly at:
 *   - stripe/webhook (V.I.Bee activation)
 *   - stripe/vendor_webhook (vendor plan activation)
 *
 * Do NOT call this endpoint from the frontend.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error:
        "This webhook is Stripe-facing and should be handled by Xano directly.",
    },
    { status: 501 }
  );
}
