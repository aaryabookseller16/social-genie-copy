import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/checkout
 * Proxies to genie/checkout-dev — requires auth (writes as $auth.id).
 *
 * Xano returns 404 if there's no active checkin to close — from the UI's
 * perspective the user is already checked out, so normalize it to a 200.
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

    const result = await xanoFetch("genie/checkout-dev", {
      method: "POST",
      authToken,
      body: { venue_id: venueId },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError && error.status === 404) {
      return NextResponse.json({ success: true, checked_out: true });
    }
    const { status, message } = toClientError(error, "Could not check out.");
    return NextResponse.json({ error: message }, { status });
  }
}
