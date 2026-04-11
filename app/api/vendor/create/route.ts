import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/vendor/create — manual add business
 * Uses the single genie/vendor_onboarding_start endpoint with step field.
 * Step 1 (search) creates the vendor record, Step 2 (contact) sets details.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const firstName = String(body.full_name ?? "").split(" ")[0] || "";
    const lastName =
      String(body.full_name ?? "").split(" ").slice(1).join(" ") || "";

    // Step 1: Search/create — creates the vendor and onboarding records
    const startResult = await xanoFetch<{
      vendor_id: number;
      onboarding_id: number;
      current_step?: string;
    }>("genie/vendor_onboarding_start", {
      method: "POST",
      body: {
        step: "search",
        business_name: body.business_name,
      },
    });

    // Step 2: Contact info
    await xanoFetch("genie/vendor_onboarding_start", {
      method: "POST",
      body: {
        step: "contact",
        vendor_id: startResult.vendor_id,
        onboarding_id: startResult.onboarding_id,
        first_name: firstName,
        last_name: lastName,
        email: body.email,
        phone: body.phone || undefined,
      },
    });

    // Step 3: Confirm
    await xanoFetch("genie/vendor_onboarding_start", {
      method: "POST",
      body: {
        step: "confirm",
        vendor_id: startResult.vendor_id,
        onboarding_id: startResult.onboarding_id,
        confirmed: true,
      },
    });

    return NextResponse.json({
      success: true,
      vendor_id: startResult.vendor_id,
      onboarding_id: startResult.onboarding_id,
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
