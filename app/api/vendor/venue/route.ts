import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/vendor/venue?external_user_id=...
 * Proxies to `genie/ep_get_venue_details_dev`. Returns venue details (name,
 * address, contact info, category/cuisine, social links) along with the
 * dashboard stats the vendor dashboard card renders.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const externalUserId =
      request.nextUrl.searchParams.get("external_user_id")?.trim() ?? "";

    if (!externalUserId) {
      return NextResponse.json(
        { error: "external_user_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch<Record<string, unknown>>(
      "genie/ep_get_venue_details_dev",
      {
        method: "GET",
        authToken,
        params: { external_user_id: externalUserId },
      }
    );

    if (result && typeof result === "object" && "error" in result) {
      const errMsg = (result as { error?: unknown }).error;
      if (errMsg) {
        return NextResponse.json(
          { error: String(errMsg) },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(result ?? {});
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/vendor/venue failed:", error);
    return NextResponse.json(
      { error: "Could not load venue details." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/vendor/venue
 * Proxies to `genie/ep_save_venue_details_dev`.
 *
 * Accepts venue-level fields (description → vibe_notes, hours_text, etc.), all
 * optional. The venue is resolved server-side from the bearer token — no user
 * or venue id is accepted from the caller, so one vendor cannot edit another's.
 */
export async function PUT(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const allowed: ReadonlyArray<keyof typeof body> = [
      "venue_name",
      "description",
      "phone",
      "website_url",
      "reservation_url",
      "reservation_platform",
      "hours_text",
      "is_open_now",
      "image_primary_url",
      "address",
      "city",
      "state",
      "zip",
    ];

    const payload: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        payload[key as string] = body[key];
      }
    }

    const result = await xanoFetch<{
      error: string | null;
      success: boolean;
    }>("genie/ep_save_venue_details_dev", {
      method: "POST",
      authToken,
      body: payload,
    });

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result ?? { success: true });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("PUT /api/vendor/venue failed:", error);
    return NextResponse.json(
      { error: "Could not update venue details." },
      { status: 500 }
    );
  }
}
