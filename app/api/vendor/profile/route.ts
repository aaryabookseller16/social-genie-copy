import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/vendor/profile?external_user_id=...
 * Proxies to `genie/ep_get_vendor_profile_dev`.
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

    const result = await xanoFetch<{
      error: string | null;
      vendor: Record<string, unknown> | null;
    }>("genie/ep_get_vendor_profile_dev", {
      method: "GET",
      authToken,
      params: { external_user_id: externalUserId },
    });

    if (result?.error) {
      return NextResponse.json(
        { error: result.error, vendor: null },
        { status: 404 }
      );
    }

    return NextResponse.json(result ?? { vendor: null });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/vendor/profile failed:", error);
    return NextResponse.json(
      { error: "Could not load vendor profile." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/vendor/profile
 * Proxies to `genie/ep_save_profile_changes_dev`.
 *
 * Body must include `external_user_id`. Only provided fields are updated —
 * omitted fields retain their current values.
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

    // Per `ep_save_profile_changes_dev` contract — these are the only fields
    // the Xano endpoint accepts. Anything else (description, phone, hours,
    // website_url, image_primary_url, vendor_id) is silently dropped.
    const allowed: ReadonlyArray<keyof typeof body> = [
      "business_name",
      "business_address",
      "city",
      "state",
      "zip",
      "location_enabled",
      "reservation_url",
      "reservation_platform",
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
    }>("genie/ep_save_profile_changes_dev", {
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
    console.error("PUT /api/vendor/profile failed:", error);
    return NextResponse.json(
      { error: "Could not update profile." },
      { status: 500 }
    );
  }
}
