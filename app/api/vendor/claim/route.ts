import { NextRequest, NextResponse } from "next/server";

import {
  nextStoreId,
  updateApiStore,
} from "@/app/lib/server/apiStore";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";
import { fetchCatalogVenuesByIds } from "@/app/lib/server/xanoCatalog";

function isEmailValid(email: string) {
  return /\S+@\S+\.\S+/.test(email);
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
  const venueId = Number(body.venue_id);
  const contactName = String(body.contact_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const selectedPlanId = String(body.selected_plan_id ?? "").trim();
  const locationEnabled =
    typeof body.location_enabled === "boolean" ? body.location_enabled : null;

  if (!Number.isFinite(venueId) || !contactName || !isEmailValid(email)) {
    return NextResponse.json(
      { error: "venue_id, contact_name, and a valid email are required" },
      { status: 400 }
    );
  }

  const [matchedVenue] = await fetchCatalogVenuesByIds([venueId]);
  if (!matchedVenue) {
    return NextResponse.json(
      { error: "Business match not found" },
      { status: 404 }
    );
  }

  const result = await updateApiStore((store) => {
    let vendor = store.vendors.find((entry) => entry.user_id === auth.user.id);

    if (!vendor) {
      vendor = {
        id: nextStoreId(store, "vendor"),
        user_id: auth.user.id,
        venue_id: venueId,
        business_name: matchedVenue.venue_name,
        contact_name: contactName,
        email,
        phone: phone || undefined,
        address: matchedVenue.address ?? undefined,
        city_state_zip:
          [matchedVenue.city, matchedVenue.area_neighborhood]
            .filter(Boolean)
            .join(", ") || undefined,
        is_manual_entry: false,
        claim_status: "submitted",
        selected_plan_id: selectedPlanId || null,
        location_enabled: locationEnabled,
        profile: {
          phone: phone || matchedVenue.phone || undefined,
          website_url: matchedVenue.website_url ?? undefined,
          reservation_url: matchedVenue.reservation_url ?? undefined,
          hours: matchedVenue.best_time_to_go ?? undefined,
          image_primary_url:
            matchedVenue.image_primary_url ??
            matchedVenue.image_fallback_url ??
            undefined,
        },
        dashboard: {
          views: 0,
          clicks: 0,
          saves: 0,
          genie_appearances: 0,
        },
        created_at: Date.now(),
      };
      store.vendors.push(vendor);
    } else {
      vendor.venue_id = venueId;
      vendor.business_name = matchedVenue.venue_name;
      vendor.contact_name = contactName;
      vendor.email = email;
      vendor.phone = phone || undefined;
      vendor.address = matchedVenue.address ?? undefined;
      vendor.city_state_zip =
        [matchedVenue.city, matchedVenue.area_neighborhood]
          .filter(Boolean)
          .join(", ") || undefined;
      vendor.is_manual_entry = false;
      vendor.claim_status = "submitted";
      vendor.selected_plan_id = selectedPlanId || vendor.selected_plan_id || null;
      vendor.location_enabled = locationEnabled;
    }

    const user = store.users.find((entry) => entry.id === auth.user.id);
    if (user) {
      user.vendor_id = vendor.id;
    }

    return vendor.claim_status;
  });

  return NextResponse.json({
    success: true,
    claim_status: result,
  });
}
