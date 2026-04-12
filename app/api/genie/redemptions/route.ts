import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/redemptions?external_user_id=...
 * Proxies to genie/user_redemptions
 */
export async function GET(request: NextRequest) {
  try {
    const externalUserId =
      request.nextUrl.searchParams.get("external_user_id")?.trim() ?? "";

    if (!externalUserId) {
      return NextResponse.json(
        { error: "external_user_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/user_redemptions", {
      params: { external_user_id: externalUserId },
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
      { error: "Could not load redemption history." },
      { status: 500 }
    );
  }
}
