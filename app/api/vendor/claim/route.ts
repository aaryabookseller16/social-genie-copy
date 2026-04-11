import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/vendor/claim
 * Latest contract: a single upstream endpoint handles the onboarding steps.
 * We proxy directly to genie/vendor_onboarding_start with the requested step.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const step = String(body.step ?? "").trim();
    if (!step) {
      return NextResponse.json(
        { error: "step is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/vendor_onboarding_start", {
      method: "POST",
      body,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/vendor/claim failed:", error);
    return NextResponse.json(
      { error: "Could not process vendor claim." },
      { status: 500 }
    );
  }
}
