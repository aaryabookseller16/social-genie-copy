import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/submit-event-survey
 * Proxies to genie/ep_submit_event_survey_dev — the "Rate Now" flow for
 * past events. Rejects duplicate submissions per (user_id, event_id)
 * upstream with a 409-style error.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const eventId = Number(body.event_id);
    if (!Number.isFinite(eventId) || eventId <= 0) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    }

    const vibeRating = body.vibe_rating != null ? Number(body.vibe_rating) : undefined;
    const venueRating = body.venue_rating != null ? Number(body.venue_rating) : undefined;

    const result = await xanoFetch("genie/ep_submit_event_survey_dev", {
      method: "POST",
      authToken,
      body: {
        event_id: eventId,
        did_attend: body.did_attend !== false,
        ...(Number.isFinite(vibeRating) ? { vibe_rating: vibeRating } : {}),
        ...(Number.isFinite(venueRating) ? { venue_rating: venueRating } : {}),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not submit rating.");
    return NextResponse.json({ error: message }, { status });
  }
}
