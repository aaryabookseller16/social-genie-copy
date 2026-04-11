import { NextRequest, NextResponse } from "next/server";
import { xanoFetch } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/analytics/track
 * Fire-and-forget analytics + vendor interaction logging.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const event = String(body.event ?? "").trim();
    if (!event) {
      return NextResponse.json(
        { error: "event is required" },
        { status: 400 }
      );
    }

    const metadata =
      typeof body.metadata === "object" && body.metadata
        ? (body.metadata as Record<string, unknown>)
        : {};

    const venueId = Number(body.venue_id || metadata.venue_id || metadata.venueId);
    const sessionId = Number(metadata.session_id || body.session_id || 0);
    const userId = Number(body.user_id || 0);
    const externalUserId = String(metadata.external_user_id || body.external_user_id || "");
    const sessionToken = String(metadata.session_token || body.session_token || "");

    // Map analytics events to vendor interaction types
    const interactionMap: Record<string, string> = {
      vendor_detail_opened: "profile_view",
      call_click: "call_click",
      vendor_call_tap: "call_click",
      map_open: "map_click",
      vendor_map_tap: "map_click",
      reserve_click: "reservation_click",
      vendor_reservation_tap: "reservation_click",
      vendor_share_tap: "share",
    };

    const interactionType = interactionMap[event];

    // If this event maps to a vendor interaction and we have a venue_id,
    // also log it as a vendor interaction for dashboard metrics.
    if (interactionType && Number.isFinite(venueId) && venueId > 0) {
      xanoFetch("genie/vendor_log_interaction", {
        method: "POST",
        body: {
          venue_id: venueId,
          interaction_type: interactionType,
          user_id: userId,
          session_id: sessionId,
        },
      }).catch(() => {
        // fire-and-forget — swallow errors
      });
    }

    // Log to prompt system for signup prompt tracking
    if (sessionId > 0) {
      const promptTriggers = [
        "venue_click",
        "decision_card_tapped",
        "save_click",
        "genie_query_submitted",
      ];
      if (promptTriggers.includes(event) && externalUserId) {
        const triggerMap: Record<string, string> = {
          venue_click: "venue_tap",
          decision_card_tapped: "venue_tap",
          save_click: "save_attempt",
          genie_query_submitted: "second_query",
        };
        xanoFetch("genie/prompt_log_event", {
          method: "POST",
          body: {
            external_user_id: externalUserId,
            session_token: sessionToken,
            event_type: triggerMap[event] || event,
            prompt_type: "signup_nudge",
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
