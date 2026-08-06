import { NextRequest, NextResponse } from "next/server";
import { xanoAuthFetch, XanoError } from "@/app/lib/server/xanoProxy";
import { setAuthCookies, isSameOriginRequest } from "@/app/lib/server/authCookies";

/**
 * POST /api/auth/login
 * Magic link login — exchanges magic_token from email link for an access +
 * refresh token pair, set as httpOnly cookies (never returned in the body).
 * Uses Auth base URL (api:dRDS80y8) → auth/verify_email/magic_login
 *
 * Xano expects: { magic_token: "..." }
 * Xano returns flat: { access_token, refresh_token, access_expires_in, user_id,
 * external_user_id, email, verified, membership_active, flow }
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const magicToken = String(body.magic_token ?? "").trim();

    if (!magicToken) {
      return NextResponse.json(
        { error: "magic_token is required" },
        { status: 400 }
      );
    }

    const result = await xanoAuthFetch<{
      access_token: string;
      refresh_token: string;
      access_expires_in: number;
      user_id: number;
      external_user_id: string;
      email: string;
      verified: boolean;
      membership_active: boolean;
      membership_started_at?: string | null;
      first_name?: string;
      last_name?: string;
      flow?: "signup" | "login";
    }>("auth/verify_email/magic_login", {
      method: "POST",
      body: { magic_token: magicToken },
    });

    const response = NextResponse.json({
      user: {
        id: result.user_id,
        email: result.email,
        first_name: result.first_name ?? "",
        last_name: result.last_name ?? "",
        membership: result.membership_active ? "vibee" : "free",
        subscription_status: result.membership_active ? "active" : "inactive",
        has_subscribed_before: Boolean(result.membership_started_at),
        vendor_id: null,
        verified: result.verified ?? false,
      },
      external_user_id: result.external_user_id,
      flow: result.flow ?? "login",
    });

    setAuthCookies(response, result.access_token, result.refresh_token);
    return response;
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/auth/login failed:", error);
    return NextResponse.json(
      { error: "Could not log you in." },
      { status: 500 }
    );
  }
}
