import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/user/unsave-venue
 * Xano uses save_venue as a toggle, so unsave proxies to the same endpoint.
 * We forward both legacy and newer identifier shapes for compatibility.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const venueId = Number(body.venue_id);
    if (!Number.isFinite(venueId)) {
      return NextResponse.json(
        { error: "venue_id is required" },
        { status: 400 }
      );
    }

    await xanoFetch("genie/save_venue", {
      method: "POST",
      body: {
        user_id: Number(body.user_id) || 0,
        session_id: Number(body.session_id) || 0,
        external_user_id: body.external_user_id ?? "",
        venue_id: venueId,
        session_token: body.session_token ?? undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Could not unsave venue." },
      { status: 500 }
    );
  }
}
