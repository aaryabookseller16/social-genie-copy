import { NextRequest, NextResponse } from "next/server";
import {
  xanoAuthFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/auth/me
 * Returns authenticated user record.
 * Uses Auth base URL (api:dRDS80y8) → auth/me
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await xanoAuthFetch<{
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      verified?: boolean;
      membership_plan?: string;
      membership_active?: boolean;
      preferred_city?: string;
      vendor_id?: number | null;
    }>("auth/me", { authToken });

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
        verified: user.verified ?? false,
      },
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/auth/me failed:", error);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
