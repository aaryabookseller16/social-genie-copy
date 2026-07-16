import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/vendor/offers?vendor_id=X
 * List offers for a vendor.
 * Proxies to genie/vendor_list_offers_dev
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const vendorId = request.nextUrl.searchParams.get("vendor_id") ?? "";

    if (!vendorId) {
      return NextResponse.json(
        { error: "vendor_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/vendor_list_offers_dev", {
      authToken,
      params: { vendor_id: vendorId },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/vendor/offers failed:", error);
    return NextResponse.json(
      { error: "Could not load offers." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/vendor/offers
 * Toggle offer active state.
 * Body: { offer_id, active }
 * Proxies to genie/vendor_update_offer_dev
 */
export async function PATCH(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!body.offer_id) {
      return NextResponse.json(
        { error: "offer_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch<{ success: boolean }>(
      "genie/vendor_update_offer_dev",
      {
        method: "POST",
        authToken,
        body: { offer_id: body.offer_id, active: body.active },
      }
    );

    return NextResponse.json(result ?? { success: true });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("PATCH /api/vendor/offers failed:", error);
    return NextResponse.json(
      { error: "Could not update offer." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vendor/offers?offer_id=X
 * Proxies to genie/vendor_delete_offer_dev
 */
export async function DELETE(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const offerId = request.nextUrl.searchParams.get("offer_id") ?? "";

    if (!offerId) {
      return NextResponse.json(
        { error: "offer_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch<{ success: boolean }>(
      "genie/vendor_delete_offer_dev",
      {
        method: "DELETE",
        authToken,
        params: { offer_id: offerId },
      }
    );

    return NextResponse.json(result ?? { success: true });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("DELETE /api/vendor/offers failed:", error);
    return NextResponse.json(
      { error: "Could not delete offer." },
      { status: 500 }
    );
  }
}
