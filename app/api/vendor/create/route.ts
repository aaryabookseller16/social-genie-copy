import { NextRequest, NextResponse } from "next/server";

import { nextStoreId, updateApiStore } from "@/app/lib/server/apiStore";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";

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
  const businessName = String(body.business_name ?? "").trim();
  const fullName = String(body.full_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const address = String(body.address ?? "").trim();
  const cityStateZip = String(body.city_state_zip ?? "").trim();
  const selectedPlanId = String(body.selected_plan_id ?? "").trim();
  const locationEnabled =
    typeof body.location_enabled === "boolean" ? body.location_enabled : null;

  if (!businessName || !fullName || !isEmailValid(email) || !address) {
    return NextResponse.json(
      {
        error:
          "business_name, full_name, email, and address are required",
      },
      { status: 400 }
    );
  }

  const vendorId = await updateApiStore((store) => {
    let vendor = store.vendors.find((entry) => entry.user_id === auth.user.id);

    if (!vendor) {
      vendor = {
        id: nextStoreId(store, "vendor"),
        user_id: auth.user.id,
        venue_id: null,
        business_name: businessName,
        contact_name: fullName,
        email,
        phone: phone || undefined,
        address,
        city_state_zip: cityStateZip || undefined,
        is_manual_entry: true,
        claim_status: "submitted",
        selected_plan_id: selectedPlanId || null,
        location_enabled: locationEnabled,
        profile: {
          phone: phone || undefined,
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
      vendor.venue_id = null;
      vendor.business_name = businessName;
      vendor.contact_name = fullName;
      vendor.email = email;
      vendor.phone = phone || undefined;
      vendor.address = address;
      vendor.city_state_zip = cityStateZip || undefined;
      vendor.is_manual_entry = true;
      vendor.claim_status = "submitted";
      vendor.selected_plan_id = selectedPlanId || vendor.selected_plan_id || null;
      vendor.location_enabled = locationEnabled;
    }

    const user = store.users.find((entry) => entry.id === auth.user.id);
    if (user) {
      user.vendor_id = vendor.id;
    }

    return vendor.id;
  });

  return NextResponse.json({
    success: true,
    vendor_id: vendorId,
  });
}
