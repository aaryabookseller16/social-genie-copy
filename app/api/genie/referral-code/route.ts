import { NextRequest, NextResponse } from "next/server";
import {
  xanoGenieV15Fetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/referral-code
 * Get-or-create the logged-in user's personal referral code.
 * Proxies to: genie/ep_referral_code_get_or_create
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

    const { code } = await request.json().catch(() => ({ code: undefined }));

    const result = await xanoGenieV15Fetch<{
      success: boolean;
      code: string;
      created_at: number | string;
    }>("genie/ep_referral_code_get_or_create", {
      method: "POST",
      authToken,
      body: code ? { code } : undefined,
    });

    return NextResponse.json({
      code: result.code,
      created_at: result.created_at,
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/genie/referral-code failed:", error);
    return NextResponse.json(
      { error: "Could not load your referral code." },
      { status: 500 }
    );
  }
}
