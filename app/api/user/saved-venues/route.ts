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

    const result = await xanoFetch<{
      saved_venues?: RawGenieVenue[];
      venues?: RawGenieVenue[];
      count: number;
    }>("genie/saved_venues", { params });

    const raw = result.saved_venues ?? result.venues ?? [];
    const venues = raw.filter(Boolean).map(mapVenue);

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
