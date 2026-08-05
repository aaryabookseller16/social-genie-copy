import { NextRequest, NextResponse } from "next/server";
import {
  xanoGenieV15Fetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/connect-onboarding
 * Returns a fresh Stripe-hosted onboarding URL, creating a Connect account
 * first if the user doesn't have one yet.
 * Proxies to: genie/ep_connect_onboarding_link
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

    const { return_url, refresh_url } = await request.json();

    const result = await xanoGenieV15Fetch<{ url: string }>(
      "genie/ep_connect_onboarding_link",
      {
        method: "POST",
        authToken,
        body: { return_url, refresh_url },
      }
    );

    return NextResponse.json({ url: result.url });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/genie/connect-onboarding failed:", error);
    return NextResponse.json(
      { error: "Could not start payout account setup." },
      { status: 500 }
    );
  }
}
