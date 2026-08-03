import { NextRequest, NextResponse } from "next/server";
import {
  xanoGenieV15Fetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/referral-dashboard
 * Returns the logged-in user's referral code plus everyone who signed up
 * through it (email masked server-side by Xano).
 * Proxies to: genie/ep_referral_dashboard
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
      success: boolean;
      code: string;
      referrals: Array<{
        first_name?: string;
        last_name?: string;
        email_masked?: string;
        created_at?: number | string;
        verified?: boolean;
        membership_active?: boolean;
      }>;
      referral_count: number;
    }>("genie/ep_referral_dashboard", { authToken });

    return NextResponse.json({
      code: result.code,
      referrals: result.referrals ?? [],
      referral_count: result.referral_count ?? 0,
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/genie/referral-dashboard failed:", error);
    return NextResponse.json(
      { error: "Could not load your referral dashboard." },
      { status: 500 }
    );
  }
}
