import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * PUT /api/vendor/venue
 * Proxies to `genie/ep_save_venue_details_dev`.
 *
 * Accepts venue-level fields (description → vibe_notes, hours_text, etc.).
 * `external_user_id` is required; all other fields are optional.
 */
export async function PUT(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const externalUserId =
      typeof body.external_user_id === "string"
        ? body.external_user_id.trim()
        : "";
    if (!externalUserId) {
      return NextResponse.json(
        { error: "external_user_id is required" },
        { status: 400 }
      );
    }

    const allowed: ReadonlyArray<keyof typeof body> = [
      "venue_name",
      "description",
      "phone",
      "website_url",
      "reservation_url",
      "reservation_platform",
      "hours_text",
      "image_primary_url",
      "address",
      "city",
      "state",
      "zip",
    ];

    const payload: Record<string, unknown> = {
      external_user_id: externalUserId,
    };
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
