import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/producer/profile
 * Proxies to: genie/ep_get_my_producer_profile_dev
 * Returns the current user's producer profile (any status) identified by JWT.
 * No query params needed.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);

    const result = await xanoFetch("genie/ep_get_my_producer_profile_dev", {
      authToken,
    });

    // Xano returns { success: true, profile: { id, display_name, status, ... } | null }
    const raw = result as { profile: Record<string, unknown> | null; success?: boolean };
    return NextResponse.json({ profile: raw.profile ?? null });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ profile: null });
    }
    return NextResponse.json({ error: "Could not fetch producer profile." }, { status: 500 });
  }
}

/**
 * POST /api/producer/profile
 * Body: { display_name, bio?, instagram_handle?, event_type_tags? }
 * Proxies to: genie/ep_setup_producer_profile_dev
 * Requires Bearer JWT (Xano uses it to identify the current user).
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const displayName = String(body.display_name ?? "").trim();
    if (!displayName) {
      return NextResponse.json({ error: "display_name is required" }, { status: 400 });
    }

    const result = await xanoFetch("genie/ep_setup_producer_profile_dev", {
      method: "POST",
      authToken,
      body: {
        display_name: displayName,
        bio: String(body.bio ?? "").trim() || undefined,
        instagram_handle: String(body.instagram_handle ?? "").trim() || undefined,
        event_type_tags: Array.isArray(body.event_type_tags) ? body.event_type_tags : undefined,
      },
    });

    console.log("[producer/profile POST] Xano response:", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not save producer profile." }, { status: 500 });
  }
}
