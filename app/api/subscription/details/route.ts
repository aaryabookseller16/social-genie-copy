import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/subscription/details
 * Next billing date + amount for the signed-in user's V.I.Bee subscription.
 * Proxies to genie/vibee_subscription_details, which looks the value up live
 * from Stripe (genie_user has no cached next-billing field).
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await xanoFetch<{
      has_subscription: boolean;
      next_payment_date: number | null;
      next_payment_amount: number | null;
      currency: string | null;
      interval: string | null;
      cancel_at_period_end: boolean;
    }>("genie/vibee_subscription_details", { authToken });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/subscription/details failed:", error);
    return NextResponse.json(
      { error: "Could not load subscription details." },
      { status: 500 }
    );
  }
}
