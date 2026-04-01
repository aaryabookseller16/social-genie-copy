import { NextRequest, NextResponse } from "next/server";

import { updateApiStore } from "@/app/lib/server/apiStore";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";

export async function GET(request: NextRequest) {
  const { auth, errorResponse } = await requireAuthenticatedUser(request);
  if (!auth) {
    return errorResponse;
  }

  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({
      status: auth.user.subscription_status,
    });
  }

  const status = await updateApiStore((store) => {
    const user = store.users.find((entry) => entry.id === auth.user.id);
    if (!user) {
      return null;
    }

    if (
      user.pending_checkout_session_id &&
      user.pending_checkout_session_id === sessionId
    ) {
      user.membership = "vibee";
      user.subscription_status = "active";
      user.pending_checkout_session_id = null;
      user.pending_checkout_started_at = null;
    }

    return user.subscription_status;
  });

  if (!status) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    status,
  });
}
