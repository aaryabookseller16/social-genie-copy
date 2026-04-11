import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * PUT /api/vendor/profile
 * Update vendor profile fields.
 */
export async function PUT(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    // For now, forward the payload directly.
    // The Xano endpoint handles field validation.
    const result = await xanoFetch("genie/vendor_profile", {
      method: "PUT",
      authToken,
      body,
    });

    return NextResponse.json(result ?? { success: true });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("PUT /api/vendor/profile failed:", error);
    return NextResponse.json(
      { error: "Could not update profile." },
      { status: 500 }
    );
  }
}
