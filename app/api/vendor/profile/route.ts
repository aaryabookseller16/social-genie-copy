import { NextRequest, NextResponse } from "next/server";

import { updateApiStore } from "@/app/lib/server/apiStore";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";

export async function PUT(request: NextRequest) {
  const { auth, errorResponse } = await requireAuthenticatedUser(request);
  if (!auth) {
    return errorResponse;
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const success = await updateApiStore((store) => {
    const vendor = store.vendors.find((entry) => entry.id === auth.user.vendor_id);
    if (!vendor) {
      return false;
    }

    if (typeof body.description === "string") {
      vendor.profile.description = body.description.trim();
    }
    if (typeof body.phone === "string") {
      vendor.profile.phone = body.phone.trim();
    }
    if (typeof body.website_url === "string") {
      vendor.profile.website_url = body.website_url.trim();
    }
    if (typeof body.reservation_url === "string") {
      vendor.profile.reservation_url = body.reservation_url.trim();
    }
    if (typeof body.hours === "string") {
      vendor.profile.hours = body.hours.trim();
    }
    if (typeof body.image_primary_url === "string") {
      vendor.profile.image_primary_url = body.image_primary_url.trim();
    }

    return true;
  });

  if (!success) {
    return NextResponse.json(
      { error: "Vendor profile not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
