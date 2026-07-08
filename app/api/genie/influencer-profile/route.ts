import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/influencer-profile
 * Returns the logged-in user's own influencer profile (flat, unwrapped).
 * Proxies to: genie/ep_get_my_influencer_profile_dev
 * Xano returns: { success, profile: { ... } } — we unwrap and return the profile directly.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);

    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const raw = await xanoFetch<{
      success: boolean;
      profile: Record<string, unknown> | null;
    }>("genie/ep_get_my_influencer_profile_dev", { authToken });

    if (!raw.success || !raw.profile) {
      return NextResponse.json(
        { error: "No influencer profile found" },
        { status: 404 }
      );
    }

    return NextResponse.json(raw.profile);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Could not load influencer profile." },
      { status: 500 }
    );
  }
}
