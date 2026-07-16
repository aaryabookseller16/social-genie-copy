import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  xanoAuthFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/vendor/create — manual add business
 * Resolves the authenticated user's ID from the Auth group, then passes it
 * explicitly to vendor_onboarding_start in the Genie_Dev group (the two groups
 * use different JWT secrets so cross-group auth tokens don't work).
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const firstName = String(body.full_name ?? "").split(" ")[0] || "";
    const lastName =
      String(body.full_name ?? "").split(" ").slice(1).join(" ") || "";

    // Resolve the numeric user_id from the auth token via the Auth group
    let userId: number | null = null;
    if (authToken) {
      try {
        const me = await xanoAuthFetch<{ id: number }>("auth/me", {
          authToken,
        });
        userId = me.id ?? null;
      } catch {
        // Not fatal — vendor will be created without a user link
      }
    }

    const result = await xanoFetch<{
      vendor_id: number;
      onboarding_id: number;
      current_step?: string;
    }>("genie/vendor_onboarding_start", {
      method: "POST",
      body: {
        user_id          : userId ?? undefined,
        business_name    : body.business_name,
        is_manual        : true,
        first_name       : firstName || undefined,
        last_name        : lastName || undefined,
        email            : body.email || undefined,
        phone            : body.phone || undefined,
        business_address : body.address || undefined,
        city             : body.city || undefined,
        state            : body.state || undefined,
        zip              : body.zip || undefined,
        reservation_url  : body.reservation_url || undefined,
        website          : body.website || undefined,
        instagram        : body.instagram || undefined,
        category         : body.category || undefined,
        cuisine          : body.cuisine || undefined,
        neighborhood     : body.neighborhood || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      vendor_id: result.vendor_id,
      onboarding_id: result.onboarding_id,
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/vendor/create failed:", error);
    return NextResponse.json(
      { error: "Could not create vendor listing." },
      { status: 500 }
    );
  }
}
