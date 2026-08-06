import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/subscription/cancel
 * Schedules the signed-in user's V.I.Bee subscription to cancel at period
 * end. Proxies to genie/cancel_vibee_subscription.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await xanoFetch<{
      cancel_at_period_end: boolean;
      current_period_end: number;
      status: string;
    }>("genie/cancel_vibee_subscription", {
      method: "POST",
      authToken,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/subscription/cancel failed:", error);
    return NextResponse.json(
      { error: "Could not cancel subscription." },
      { status: 500 }
    );
  }
}
