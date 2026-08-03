import { NextRequest, NextResponse } from "next/server";
import { xanoAuthFetch } from "@/app/lib/server/xanoProxy";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  isSameOriginRequest,
} from "@/app/lib/server/authCookies";

/**
 * POST /api/auth/logout
 * Revokes the refresh session server-side (so a leaked/stolen refresh token
 * can't outlive an explicit logout), then clears both cookies. Best-effort —
 * always clears cookies even if the Xano revoke call fails, so the client
 * never gets stuck "logged in" locally.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await xanoAuthFetch("auth/logout", {
      method: "POST",
      body: { refresh_token: refreshToken },
    }).catch((error) => {
      console.error("POST /api/auth/logout: Xano revoke failed:", error);
    });
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
