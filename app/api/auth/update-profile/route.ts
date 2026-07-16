import { NextRequest, NextResponse } from "next/server";
import {
  xanoAuthFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/auth/update-profile
 *
 * Updates the authenticated CONSUMER user's profile
 * (first_name, last_name, phone, display_name, avatar_url).
 *
 * `email` is not editable: it is the identity the magic-link login resolves
 * against, and changing it without re-verification would lock the user out.
 *
 * Proxies to Xano Auth base URL (api:dRDS80y8) → `auth/update_profile`.
 * Auth is via bearer token (JWT).
 *
 * For VENDOR contact-info edits (V-05 flow), use `/api/vendor/contact-info`
 * which proxies to `genie/ep_save_contact_info_dev`.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const payload: Record<string, string> = {};

    if (body.first_name !== undefined) {
      payload.first_name = String(body.first_name).trim();
    }
    if (body.last_name !== undefined) {
      payload.last_name = String(body.last_name).trim();
    }
    if (body.phone !== undefined) {
      payload.phone = String(body.phone).trim();
    }
    if (body.display_name !== undefined) {
      payload.display_name = String(body.display_name).trim();
    }
    if (body.avatar_url !== undefined) {
      payload.avatar_url = String(body.avatar_url).trim();
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { error: "No profile fields provided." },
        { status: 400 }
      );
    }

    const user = await xanoAuthFetch<{
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      display_name?: string;
      avatar_url?: string;
      verified?: boolean;
      membership_active?: boolean;
      vendor_id?: number | null;
    }>("auth/update_profile", {
      method: "POST",
      body: payload,
      authToken,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone ?? null,
        display_name: user.display_name ?? null,
        avatar_url: user.avatar_url ?? null,
        membership: user.membership_active ? "vibee" : "free",
        subscription_status: user.membership_active ? "active" : "inactive",
        vendor_id: user.vendor_id ?? null,
        verified: user.verified ?? false,
      },
    });
  } catch (error) {
    if (error instanceof XanoError) {
      // Xano returns "Unable to locate request" with a 404 when the consumer
      // auth/update_profile endpoint hasn't been built yet. Surface a
      // friendlier message rather than the raw backend error.
      const isMissingEndpoint =
        error.status === 404 ||
        /unable to locate request/i.test(error.message);
      if (isMissingEndpoint) {
        return NextResponse.json(
          {
            error:
              "Profile editing isn't available right now. Please try again later or contact support.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/auth/update-profile failed:", error);
    return NextResponse.json(
      { error: "Could not save profile changes." },
      { status: 500 }
    );
  }
}
