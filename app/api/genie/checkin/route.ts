import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/checkin
 * Proxies to genie/checkin-dev — requires auth (writes as $auth.id).
 *
 * Xano returns 409 if the user already has an active checkin at this venue.
 * That's not an error from the UI's perspective — it just means the button
 * should already read "checked in" — so we normalize it to a 200.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const venueId = Number(body.venue_id);
    if (!Number.isFinite(venueId) || venueId <= 0) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    const result = await xanoFetch("genie/checkin-dev", {
      method: "POST",
      authToken,
      body: { venue_id: venueId },
    });

    return NextResponse.json({ success: true, already_checked_in: false, ...(result as object) });
  } catch (error) {
    if (error instanceof XanoError && error.status === 409) {
      return NextResponse.json({ success: true, already_checked_in: true });
    }
    const { status, message } = toClientError(error, "Could not check in.");
    return NextResponse.json({ error: message }, { status });
  }
}
