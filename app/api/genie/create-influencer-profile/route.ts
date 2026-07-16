import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/create-influencer-profile
 * Body: { display_name (required), bio?, instagram_handle?, tiktok_handle?, content_niche? }
 * Proxies to: genie/ep_create_influencer_profile_dev
 *
 * Xano returns:
 *   success → { success: true, profile: { ... } }  — unwrap and return profile
 *   duplicate → { success: false, error: "Influencer profile already exists", profile_id, handle }
 *               — fetch and return the existing profile so client stays consistent
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);

    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const displayName = String(body.display_name ?? "").trim();
    if (!displayName) {
      return NextResponse.json(
        { error: "display_name is required" },
        { status: 400 }
      );
    }

    const raw = await xanoFetch<{
      success: boolean;
      profile?: Record<string, unknown> | null;
      error?: string;
      profile_id?: number;
      handle?: string;
    }>("genie/ep_create_influencer_profile_dev", {
      method: "POST",
      authToken,
      body: {
        display_name: displayName,
        bio: String(body.bio ?? "").trim() || undefined,
        instagram_handle:
          String(body.instagram_handle ?? "").trim() || undefined,
        tiktok_handle: String(body.tiktok_handle ?? "").trim() || undefined,
        content_niche: String(body.content_niche ?? "").trim() || undefined,
      },
    });

    // Created successfully — unwrap profile
    if (raw.success && raw.profile) {
      return NextResponse.json(raw.profile);
    }

    // Profile already exists — fetch and return the existing one
    if (!raw.success && raw.error?.includes("already exists")) {
      const existing = await xanoFetch<{
        success: boolean;
        profile: Record<string, unknown> | null;
      }>("genie/ep_get_my_influencer_profile_dev", { authToken });

      if (existing.success && existing.profile) {
        return NextResponse.json(existing.profile);
      }
    }

    return NextResponse.json(
      { error: raw.error ?? "Could not create influencer profile." },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Could not create influencer profile." },
      { status: 500 }
    );
  }
}
