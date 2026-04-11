import { NextRequest, NextResponse } from "next/server";
import { xanoStripeFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/stripe/sessions — Create a Stripe checkout session
 * GET  /api/stripe/sessions — List checkout sessions
 * Uses Stripe base URL (api:jQf3GatY) → sessions
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const result = await xanoStripeFetch("sessions", {
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
    console.error("POST /api/stripe/sessions failed:", error);
    return NextResponse.json(
      { error: "Could not create checkout session." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await xanoStripeFetch("sessions");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/stripe/sessions failed:", error);
    return NextResponse.json(
      { error: "Could not list checkout sessions." },
      { status: 500 }
    );
  }
}
