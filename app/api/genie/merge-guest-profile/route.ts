import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/merge-guest-profile
 * Proxies to genie/merge_guest_profile
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const deviceId = String(body.device_id ?? "").trim();
    const externalUserId = String(body.external_user_id ?? "").trim();

    if (!deviceId || !externalUserId) {
      return NextResponse.json(
        { error: "device_id and external_user_id are required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/merge_guest_profile", {
      method: "POST",
      body: {
        device_id: deviceId,
        external_user_id: externalUserId,
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
      { error: "Could not merge guest profile." },
      { status: 500 }
    );
  }
}
