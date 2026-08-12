import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";
import { type RawGenieVenue } from "@/app/lib/genieTypes";
import { mapVenue } from "@/app/lib/genieMappers";

/**
 * GET /api/user/saved-venues?external_user_id=X&session_token=Y
 * Proxies to Xano genie/saved_venues.
 *
 * The live backend may still rely on `user_id` / `session_id`, so we
 * forward both the legacy and newer identifier shapes.
 */
export async function GET(request: NextRequest) {
  try {
    const externalUserId =
      request.nextUrl.searchParams.get("external_user_id") ??
      request.nextUrl.searchParams.get("user_id") ??
      "";
    const sessionToken =
      request.nextUrl.searchParams.get("session_token") ?? "";
    const userId = request.nextUrl.searchParams.get("user_id") ?? "";
    const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";

    if (!externalUserId && !userId && !sessionId) {
      return NextResponse.json({ venues: [] });
    }

    const params: Record<string, string> = {};
    if (externalUserId) params.external_user_id = externalUserId;
    if (userId) params.user_id = userId;
    if (sessionId) params.session_id = sessionId;
    if (sessionToken) params.session_token = sessionToken;

    // Each row from genie/saved_venues is a bookmark record (its own `id`,
    // pointing at a venue via `venue_id`) with the actual venue embedded
    // under `venue`. `venue` is null when the venue itself was deleted.
    const result = await xanoFetch<{
      saved_venues?: Array<{ venue: RawGenieVenue | null }>;
      venues?: Array<{ venue: RawGenieVenue | null }>;
      count: number;
    }>("genie/saved_venues", { params });

    const raw = result.saved_venues ?? result.venues ?? [];
    const venues = raw
      .map((entry) => entry.venue)
      .filter((venue): venue is RawGenieVenue => Boolean(venue))
      .map(mapVenue);

    return NextResponse.json({ venues });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/user/saved-venues failed:", error);
    return NextResponse.json(
      { error: "Could not load saved venues." },
      { status: 500 }
    );
  }
}
