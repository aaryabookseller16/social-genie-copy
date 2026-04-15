import { NextRequest, NextResponse } from "next/server";
import {
  xanoAuthFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

function isEmailValid(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

/**
 * POST /api/auth/update-profile
 *
 * Updates the authenticated user's profile (first_name, last_name, email, phone).
 * Proxies to Xano Auth base URL (api:dRDS80y8) → `auth/update_profile`.
 *
 * The bearer token is required; only fields present in the request body are
 * forwarded so the backend can do a partial update.
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
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (email && !isEmailValid(email)) {
        return NextResponse.json(
          { error: "Invalid email address" },
          { status: 400 }
        );
      }
      payload.email = email;
    }
    if (body.phone !== undefined) {
      payload.phone = String(body.phone).trim();
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
        membership: user.membership_active ? "vibee" : "free",
        subscription_status: user.membership_active ? "active" : "inactive",
        vendor_id: user.vendor_id ?? null,
      },
    });
  } catch (error) {
    if (error instanceof XanoError) {
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
