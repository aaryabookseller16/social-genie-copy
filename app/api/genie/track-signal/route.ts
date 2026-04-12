import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/track-signal
 * Proxies to genie/track_signal
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const deviceId = String(body.device_id ?? "").trim();
    const signalType = String(body.signal_type ?? "").trim();
    const signalValue = String(body.signal_value ?? "").trim();

    if (!deviceId || !signalType || !signalValue) {
      return NextResponse.json(
        { error: "device_id, signal_type, and signal_value are required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/track_signal", {
      method: "POST",
      body: {
        device_id: deviceId,
        external_user_id: String(body.external_user_id ?? "").trim() || undefined,
        signal_type: signalType,
        signal_value: signalValue,
        category_tags: Array.isArray(body.category_tags) ? body.category_tags : undefined,
        city: String(body.city ?? "").trim() || undefined,
        neighborhood: String(body.neighborhood ?? "").trim() || undefined,
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
      { error: "Could not track signal." },
      { status: 500 }
    );
  }
}
