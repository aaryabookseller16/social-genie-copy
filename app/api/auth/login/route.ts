import { NextRequest, NextResponse } from "next/server";
import { xanoAuthFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/auth/login
 * Magic link login — exchanges magic_token from email link for authToken.
 * Uses Auth base URL (api:dRDS80y8) → auth/verify_email/magic_login
 *
 * Xano expects: { magic_token: "..." }
 * Xano returns flat: { authToken, user_id, external_user_id, email, verified, membership_active }
 */
export async function POST(request: NextRequest) {
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
      authToken: string;
      user_id: number;
      external_user_id: string;
      email: string;
      verified: boolean;
      membership_active: boolean;
      first_name?: string;
      last_name?: string;
      is_new_user?: boolean;
    }>("auth/verify_email/magic_login", {
      method: "POST",
      body: { magic_token: magicToken },
    });

    return NextResponse.json({
      token: result.authToken,
      user: {
        id: result.user_id,
        email: result.email,
        first_name: result.first_name ?? "",
        last_name: result.last_name ?? "",
        membership: result.membership_active ? "vibee" : "free",
        subscription_status: result.membership_active ? "active" : "inactive",
        vendor_id: null,
      },
      external_user_id: result.external_user_id,
      is_new_user: result.is_new_user ?? false,
    });
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
