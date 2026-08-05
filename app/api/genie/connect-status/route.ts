import { NextRequest, NextResponse } from "next/server";
import {
  xanoGenieV15Fetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/connect-status
 * Live-checks (via Xano, which live-checks Stripe) whether the logged-in
 * user has a Connect account and whether it's verified for payouts.
 * Proxies to: genie/ep_connect_status
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);

    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const result = await xanoGenieV15Fetch<{
      has_account: boolean;
      payouts_enabled: boolean;
    }>("genie/ep_connect_status", { authToken });

    return NextResponse.json({
      has_account: result.has_account ?? false,
      payouts_enabled: result.payouts_enabled ?? false,
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/genie/connect-status failed:", error);
    return NextResponse.json(
      { error: "Could not check your payout account status." },
      { status: 500 }
    );
  }
}
