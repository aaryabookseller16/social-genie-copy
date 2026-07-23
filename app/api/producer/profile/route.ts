import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
  toClientError,
} from "@/app/lib/server/xanoProxy";
import { jsonNoStore } from "@/app/lib/server/apiResponse";

/**
 * GET /api/producer/profile
 * Proxies to: genie/ep_get_my_producer_profile_dev
 * Returns the current user's producer profile (any status) identified by JWT.
 * No query params needed.
 *
 * That endpoint is `auth = "genie_user"` and always replies
 * `{ success: true, profile: <row>|null }` — a user with no producer profile is
 * still a 200 with `profile: null`. So a Xano *error* never means "not a
 * producer", it only ever means "could not check".
 *
 * This route used to collapse every XanoError into `{ profile: null }` with a
 * 200, making an expired token or a Xano blip indistinguishable from a genuine
 * first-time user. ProducerSection then showed the onboarding form to people who
 * had already completed it — and because the failure was dressed up as a
 * success, the service worker cached it and the wrong answer became permanent.
 * Real errors now propagate with their real status.
 */
export async function GET(request: NextRequest) {
  const authToken = extractBearerToken(request);
  if (!authToken) {
    return jsonNoStore({ error: "Unauthorized" }, 401);
  }

  try {
    const result = await xanoFetch<{
      profile: Record<string, unknown> | null;
      success?: boolean;
    }>("genie/ep_get_my_producer_profile_dev", { authToken });

    return jsonNoStore({ profile: result.profile ?? null });
  } catch (error) {
    const { status, message } = toClientError(
      error,
      "Could not check your producer profile."
    );
    return jsonNoStore({ error: message }, status);
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
