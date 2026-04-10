import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/vendor/create — manual add business
 * Proxies to genie/vendor_onboarding_manual
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    // Step 1: Start onboarding (creates vendor record)
    const startResult = await xanoFetch<{
      vendor_id: number;
      onboarding_id: number;
      success: boolean;
    }>("genie/vendor_onboarding_start", {
      method: "POST",
      body: {
        business_name: body.business_name,
        email: body.email,
        first_name: String(body.full_name ?? "").split(" ")[0] || "",
        last_name: String(body.full_name ?? "").split(" ").slice(1).join(" ") || "",
      },
    });

    // Step 2: Submit manual business details
    await xanoFetch("genie/vendor_onboarding_manual", {
      method: "POST",
      body: {
        vendor_id: startResult.vendor_id,
        business_name: body.business_name,
        business_address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zip,
        phone: body.phone,
        email: body.email,
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
