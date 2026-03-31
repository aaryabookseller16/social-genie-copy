import { NextRequest, NextResponse } from "next/server";

import {
  findStoredVendorByVenueId,
  nextStoreId,
  updateApiStore,
} from "@/app/lib/server/apiStore";
import { getAuthenticatedUser } from "@/app/lib/server/requestAuth";

function bumpVendorMetrics(
  event: string,
  venueId: number | null,
  vendor: ReturnType<typeof findStoredVendorByVenueId>
) {
  if (!vendor) {
    return;
  }

  if (
    event === "venue_click" ||
    event === "decision_card_tapped" ||
    event === "more_nearby_card_tapped" ||
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

  if ((event === "save_click" || event === "venue_saved") && venueId) {
    vendor.dashboard.saves += 1;
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);

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

  if (!event) {
    return NextResponse.json({ error: "event is required" }, { status: 400 });
  }

  await updateApiStore((store) => {
    store.analytics.push({
      id: nextStoreId(store, "analytics"),
      event,
      user_id: auth?.user.id,
      venue_id: Number.isFinite(venueId) ? venueId : undefined,
      metadata,
      timestamp: Date.now(),
    });

    const vendor = Number.isFinite(venueId)
      ? findStoredVendorByVenueId(store, venueId)
      : undefined;
    bumpVendorMetrics(event, Number.isFinite(venueId) ? venueId : null, vendor);
  });

  return NextResponse.json({ success: true });
}
