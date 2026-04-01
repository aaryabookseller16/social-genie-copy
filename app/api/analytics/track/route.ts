import { NextRequest, NextResponse } from "next/server";

import {
  findStoredVendorByVenueId,
  nextStoreId,
  updateApiStore,
} from "@/app/lib/server/apiStore";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";

function bumpVendorMetrics(
  event: string,
  vendor: ReturnType<typeof findStoredVendorByVenueId>
) {
  if (!vendor) {
    return;
  }

  // Dashboard "clicks" tracks CTA interactions only (call/reserve/share).
  if (
    event === "call_click" ||
    event === "reserve_click" ||
    event === "vendor_share_tap"
  ) {
    vendor.dashboard.clicks += 1;
  }

  if (
    event === "vendor_detail_opened"
  ) {
    vendor.dashboard.views += 1;
  }

  if (
    event === "result_impression" ||
    event === "genie_result_impression" ||
    event === "more_nearby_card_impression"
  ) {
    vendor.dashboard.genie_appearances += 1;
  }

  // "saves" is mutated by /user/save-venue after a successful save operation.
  // Avoid incrementing from analytics events to prevent duplicate counts.
}

export async function POST(request: NextRequest) {
  const { auth, errorResponse } = await requireAuthenticatedUser(request);
  if (!auth) {
    return errorResponse;
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const event = String(body.event ?? "").trim();
  const venueId = Number(body.venue_id);
  const metadata =
    typeof body.metadata === "object" && body.metadata
      ? (body.metadata as Record<string, unknown>)
      : undefined;
  const metadataVenueId = metadata
    ? (metadata.venue_id ?? metadata.venueId)
    : undefined;
  const resolvedVenueId = Number(
    Number.isFinite(venueId) ? venueId : metadataVenueId
  );

  if (!event) {
    return NextResponse.json({ error: "event is required" }, { status: 400 });
  }

  await updateApiStore((store) => {
    store.analytics.push({
      id: nextStoreId(store, "analytics"),
      event,
      user_id: auth.user.id,
      venue_id: Number.isFinite(resolvedVenueId) ? resolvedVenueId : undefined,
      metadata,
      timestamp: Date.now(),
    });

    const vendor = Number.isFinite(resolvedVenueId)
      ? findStoredVendorByVenueId(store, resolvedVenueId)
      : undefined;
    bumpVendorMetrics(
      event,
      vendor
    );
  });

  return NextResponse.json({ success: true });
}
