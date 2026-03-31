import { NextRequest, NextResponse } from "next/server";

import { readApiStore } from "@/app/lib/server/apiStore";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";

export async function GET(request: NextRequest) {
  const { auth, errorResponse } = await requireAuthenticatedUser(request);
  if (!auth) {
    return errorResponse;
  }

  const store = await readApiStore();
  const vendor = store.vendors.find((entry) => entry.id === auth.user.vendor_id);

  if (!vendor) {
    return NextResponse.json(
      { error: "Vendor profile not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(vendor.dashboard);
}
