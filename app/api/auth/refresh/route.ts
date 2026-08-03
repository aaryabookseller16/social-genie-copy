import { NextRequest, NextResponse } from "next/server";
import { xanoAuthFetch, XanoError } from "@/app/lib/server/xanoProxy";
import {
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  isSameOriginRequest,
} from "@/app/lib/server/authCookies";

/**
 * POST /api/auth/refresh
 * Exchanges the refresh-token cookie for a fresh access+refresh pair.
 * Uses Auth base URL (api:dRDS80y8) → auth/refresh
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  try {
    const result = await xanoAuthFetch<{
      access_token: string;
      refresh_token: string;
      access_expires_in: number;
    }>("auth/refresh", {
      method: "POST",
      body: { refresh_token: refreshToken },
    });

    const response = NextResponse.json({ ok: true });
    setAuthCookies(response, result.access_token, result.refresh_token);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      {
        error:
          error instanceof XanoError ? error.message : "Session expired.",
      },
      { status: error instanceof XanoError ? error.status : 401 }
    );
    clearAuthCookies(response);
    return response;
  }
}
