import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { updateApiStore } from "@/app/lib/server/apiStore";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";

export async function POST(request: NextRequest) {
  const { auth, errorResponse } = await requireAuthenticatedUser(request);
  if (!auth) {
    return errorResponse;
  }

  const checkoutSessionId = await updateApiStore((store) => {
    const user = store.users.find((entry) => entry.id === auth.user.id);
    if (!user) {
      return null;
    }

    const mockSessionId = `cs_test_${randomUUID().replace(/-/g, "")}`;
    user.pending_checkout_session_id = mockSessionId;
    user.pending_checkout_started_at = Date.now();
    return mockSessionId;
  });

  if (!checkoutSessionId) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const checkoutUrl = new URL("/", request.nextUrl.origin);
  checkoutUrl.searchParams.set("checkout", "success");
  checkoutUrl.searchParams.set("session_id", checkoutSessionId);

  return NextResponse.json({
    checkout_url: checkoutUrl.toString(),
  });
}
