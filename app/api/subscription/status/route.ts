import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";

export async function GET(request: NextRequest) {
  const { auth, errorResponse } = await requireAuthenticatedUser(request);
  if (!auth) {
    return errorResponse;
  }

  return NextResponse.json({
    status: auth.user.subscription_status,
  });
}
