import { NextRequest, NextResponse } from "next/server";
import {
  xanoGenieV15Fetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/referral-withdraw
 * Pays out the logged-in user's available referral balance ($5 minimum) to
 * their verified Stripe Connect account.
 * Proxies to: genie/ep_referral_withdraw
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

    const result = await xanoGenieV15Fetch<{
      success: boolean;
      amount: number;
      transfer_id: string;
    }>("genie/ep_referral_withdraw", { method: "POST", authToken });

    return NextResponse.json({
      success: result.success,
      amount: result.amount,
      transfer_id: result.transfer_id,
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/genie/referral-withdraw failed:", error);
    return NextResponse.json(
      { error: "Could not process your withdrawal." },
      { status: 500 }
    );
  }
}
