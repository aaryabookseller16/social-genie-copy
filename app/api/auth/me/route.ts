import { NextRequest, NextResponse } from "next/server";

import { sanitizeUser } from "@/app/lib/server/apiStore";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";

export async function GET(request: NextRequest) {
  const { auth, errorResponse } = await requireAuthenticatedUser(request);
  if (!auth) {
    return errorResponse;
  }

  return NextResponse.json({
    user: sanitizeUser(auth.user),
  });
}
