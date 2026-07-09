import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

const VALID_STATUSES = new Set(["going", "interested", "saved", "removed"]);

/**
 * POST /api/genie/rsvp-event
 * Proxies to genie/ep_rsvp_event_dev — requires auth (writes as $auth.id).
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const eventId = Number(body.event_id);
    const status = String(body.status ?? "");

    if (!Number.isFinite(eventId) || eventId <= 0) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    }
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "status must be one of going, interested, saved, removed" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/ep_rsvp_event_dev", {
      method: "POST",
      authToken,
      body: {
        event_id: eventId,
        status,
        source: typeof body.source === "string" ? body.source : undefined,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not save RSVP.");
    return NextResponse.json({ error: message }, { status });
  }
}
