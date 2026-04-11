import { NextRequest, NextResponse } from "next/server";
import {
  xanoAuthFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/subscription/status
 * Returns membership status via auth/me (Auth base URL).
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await xanoAuthFetch<{
      membership_active?: boolean;
      membership_plan?: string;
    }>("auth/me", { authToken });

    const status = user.membership_active ? "active" : "inactive";
    return NextResponse.json({ status });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/subscription/status failed:", error);
    return NextResponse.json(
      { error: "Could not check subscription status." },
      { status: 500 }
    );
  }
}
