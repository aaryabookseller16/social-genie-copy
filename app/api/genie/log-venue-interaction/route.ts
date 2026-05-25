import { NextRequest, NextResponse } from "next/server";
import { xanoFetch } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/log-venue-interaction
 * Fire-and-forget venue interaction logging for behavioral learning.
 * Feeds genie_user_venue_interaction + genie_behavior_signals.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await xanoFetch<{
      success: boolean;
      logged: boolean;
      interaction_type: string;
      venue_id: number;
    }>("genie/ep_log_venue_interaction_dev", {
      method: "POST",
      body: {
        venue_id: body.venue_id,
        interaction_type: body.interaction_type,
        user_id: body.user_id ?? 0,
        session_id: body.session_id ?? 0,
        source_screen: body.source_screen ?? "",
      },
    });
    return NextResponse.json(result);
  } catch {
    // fire-and-forget — never fail the user
    return NextResponse.json({ logged: true });
  }
}