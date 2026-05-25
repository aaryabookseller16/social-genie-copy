import { NextRequest, NextResponse } from "next/server";
import { xanoFetch } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/log-event-interaction
 * Fire-and-forget event interaction logging for behavioral learning.
 * Feeds genie_user_event_interaction + genie_behavior_signals.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await xanoFetch<{
      success: boolean;
      logged: boolean;
      interaction_type: string;
      event_id: number;
      event_category: string;
    }>("genie/ep_log_event_interaction_dev", {
      method: "POST",
      body: {
        event_id: body.event_id,
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