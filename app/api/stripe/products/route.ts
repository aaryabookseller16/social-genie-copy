import { NextResponse } from "next/server";
import { xanoStripeFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/stripe/products
 * Returns available Stripe products/plans.
 * Uses Stripe base URL (api:jQf3GatY) → products
 */
export async function GET() {
  try {
    const result = await xanoStripeFetch("products");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/stripe/products failed:", error);
    return NextResponse.json(
      { error: "Could not load products." },
      { status: 500 }
    );
  }
}
