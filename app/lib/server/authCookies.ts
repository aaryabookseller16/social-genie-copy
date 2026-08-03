import { NextResponse } from "next/server";

export const ACCESS_COOKIE = "genie_access_token";
export const REFRESH_COOKIE = "genie_refresh_token";

const isProd = process.env.NODE_ENV === "production";

export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string
) {
  res.cookies.set(ACCESS_COOKIE, accessToken, {
    // NOT httpOnly: the realtime messaging SDK (app/lib/realtimeMessaging.ts)
    // needs the raw access token in JS to send as the WebSocket subprotocol —
    // an httpOnly cookie can't be read for that. This is a deliberate,
    // narrower tradeoff than a fully httpOnly access token: it's short-lived
    // (24h) and readable, same exposure profile as the old localStorage
    // token. The refresh token below (the valuable 365-day credential) stays
    // httpOnly, which is the security win that actually matters here.
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 31536000,
  });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { path: "/api/auth", maxAge: 0 });
}

/** Same-origin check for the state-changing auth routes (login/refresh/logout) — cheap CSRF defense-in-depth on top of SameSite=Lax. */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Same-origin requests from a browser's fetch() often omit Origin; only
    // reject when an Origin header is present and it doesn't match.
    return true;
  }
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
