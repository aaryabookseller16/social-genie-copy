import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/social-profile?device_id=... or ?external_user_id=...
 * POST /api/genie/social-profile
 * Proxies to:
 *   genie/get_social_profile
 *   genie/update_social_profile
 */
export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get("device_id")?.trim() ?? "";
    const externalUserId =
      request.nextUrl.searchParams.get("external_user_id")?.trim() ?? "";

    if (!deviceId && !externalUserId) {
      return NextResponse.json(
        { error: "device_id or external_user_id is required" },
        { status: 400 }
      );
    }

    const params: Record<string, string> = {};
    if (externalUserId) {
      params.external_user_id = externalUserId;
    } else if (deviceId) {
      params.device_id = deviceId;
    }

    const result = await xanoFetch("genie/get_social_profile", { params });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Could not load social profile." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const deviceId = String(body.device_id ?? "").trim();
    const externalUserId = String(body.external_user_id ?? "").trim();
    if (!deviceId && !externalUserId) {
      return NextResponse.json(
        { error: "device_id or external_user_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/update_social_profile", {
      method: "POST",
      body: {
        device_id: deviceId || undefined,
        external_user_id: externalUserId || undefined,
        experiences_tags: Array.isArray(body.experiences_tags)
          ? body.experiences_tags
          : undefined,
        atmosphere_tags: Array.isArray(body.atmosphere_tags)
          ? body.atmosphere_tags
          : undefined,
        bevy_bites_tags: Array.isArray(body.bevy_bites_tags)
          ? body.bevy_bites_tags
          : undefined,
        community_tags: Array.isArray(body.community_tags)
          ? body.community_tags
          : undefined,
        music_tags: Array.isArray(body.music_tags) ? body.music_tags : undefined,
        price_range: String(body.price_range ?? "").trim() || undefined,
        group_size: String(body.group_size ?? "").trim() || undefined,
        typical_time: String(body.typical_time ?? "").trim() || undefined,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Could not update social profile." },
      { status: 500 }
    );
  }
}
