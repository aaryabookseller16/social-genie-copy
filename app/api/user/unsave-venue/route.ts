import { NextRequest, NextResponse } from "next/server";

import { updateApiStore } from "@/app/lib/server/apiStore";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";

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

  if (!Number.isFinite(venueId)) {
    return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
  }

  await updateApiStore((store) => {
    const user = store.users.find((entry) => entry.id === auth.user.id);
    if (!user) {
      return;
    }

    user.saved_venue_ids = user.saved_venue_ids.filter((id) => id !== venueId);
  });

  return NextResponse.json({ success: true });
}
