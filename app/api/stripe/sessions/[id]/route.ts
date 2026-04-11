import { NextRequest, NextResponse } from "next/server";
import { xanoStripeFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/stripe/sessions/[id] — Get a Stripe checkout session by ID
 * Uses Stripe base URL (api:jQf3GatY) → sessions/{id}
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const result = await xanoStripeFetch(`sessions/${id}`);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/stripe/sessions/[id] failed:", error);
    return NextResponse.json(
      { error: "Could not load checkout session." },
      { status: 500 }
    );
  }
}
