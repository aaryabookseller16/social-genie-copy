import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/save-producer-details
 * Body: { external_user_id, brand_name?, producer_handle? }
 * Proxies to: save_producer_details
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

    const result = await xanoFetch("save_producer_details", {
      method: "POST",
      body: {
        external_user_id: externalUserId,
        brand_name: String(body.brand_name ?? "").trim() || undefined,
        producer_handle: String(body.producer_handle ?? "").trim() || undefined,
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
      { error: "Could not save producer details." },
      { status: 500 }
    );
  }
}
