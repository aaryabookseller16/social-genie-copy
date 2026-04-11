import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/user/save-venue
 * Proxies to Xano genie/save_venue.
 *
 * The current Xano backend still enforces `user_id` or `session_id`,
 * even though newer docs describe `external_user_id` and `session_token`.
 * We forward both shapes so the app works against the live backend.
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

    const result = await xanoFetch<{
      success: boolean;
      saved_venue_id?: number;
      prompt_signup?: boolean;
      saved?: boolean;
      already_saved?: boolean;
    }>("genie/save_venue", {
      method: "POST",
      body: {
        user_id: Number(body.user_id) || 0,
        session_id: Number(body.session_id) || 0,
        external_user_id: body.external_user_id ?? "",
        venue_id: venueId,
        session_token: body.session_token ?? undefined,
      },
    });

    return NextResponse.json({
      success: result.saved ?? true,
      saved: result.saved ?? true,
      already_saved: result.already_saved ?? false,
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/user/save-venue failed:", error);
    return NextResponse.json(
      { error: "Could not save venue." },
      { status: 500 }
    );
  }
}
