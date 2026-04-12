import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/init-device
 * Proxies to genie/init_device
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const deviceId = String(body.device_id ?? "").trim();
    if (!deviceId) {
      return NextResponse.json(
        { error: "device_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/init_device", {
      method: "POST",
      body: {
        device_id: deviceId,
        external_user_id: String(body.external_user_id ?? "").trim() || undefined,
        session_id: String(body.session_id ?? "").trim() || undefined,
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
      { error: "Could not initialize device profile." },
      { status: 500 }
    );
  }
}
