import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/verify-redemption/[token]
 * Proxies to genie/verify_redemption?redemption_token=...
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const redemptionToken = String(token ?? "").trim();

    if (!redemptionToken) {
      return NextResponse.json(
        { error: "redemption token is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/verify_redemption", {
      params: { redemption_token: redemptionToken },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Could not verify redemption token." },
      { status: 500 }
    );
  }
}
