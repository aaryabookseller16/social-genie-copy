import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/save-influencer-details
 * Body: { external_user_id, influencer_handle? }
 * Proxies to: save_influencer_details
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const externalUserId = String(body.external_user_id ?? "").trim();
    if (!externalUserId) {
      return NextResponse.json(
        { error: "external_user_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("save_influencer_details", {
      method: "POST",
      body: {
        external_user_id: externalUserId,
        influencer_handle:
          String(body.influencer_handle ?? "").trim() || undefined,
      },
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
      { error: "Could not save influencer details." },
      { status: 500 }
    );
  }
}
