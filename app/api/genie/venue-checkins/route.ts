import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

type XanoCheckinRow = { user_id?: number };
type XanoVenueCheckinsResponse = {
  success: boolean;
  venue_id: number;
  active_checkins: number;
  checkins: XanoCheckinRow[];
};

/**
 * GET /api/genie/venue-checkins?venue_id=&user_id=
 * Proxies to genie/get-venue-checkins-dev — requires auth.
 *
 * Xano's response includes the raw per-user checkin rows (each with a
 * user_id), which would leak other users' identities to the browser if
 * forwarded as-is. We only need "is *this* user checked in" — so we
 * resolve that boolean server-side against the caller-supplied user_id
 * and strip the row list before responding.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const venueId = request.nextUrl.searchParams.get("venue_id");
    if (!venueId || Number.isNaN(Number(venueId))) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }
    const userId = request.nextUrl.searchParams.get("user_id");

    const result = await xanoFetch<XanoVenueCheckinsResponse>(
      "genie/get-venue-checkins-dev",
      { params: { venue_id: venueId }, authToken }
    );

    const userIdNum = userId ? Number(userId) : null;
    const userIsCheckedIn =
      userIdNum != null &&
      (result.checkins ?? []).some((row) => row.user_id === userIdNum);

    return NextResponse.json({
      success: result.success,
      venue_id: result.venue_id,
      active_checkins: result.active_checkins,
      user_is_checked_in: userIsCheckedIn,
    });
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load check-ins.");
    return NextResponse.json({ error: message }, { status });
  }
}
