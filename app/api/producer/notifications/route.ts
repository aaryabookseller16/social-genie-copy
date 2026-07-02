import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const result = await xanoFetch(
      "genie/get-notification-preferences-dev",
      { authToken }
    );
    const wrapped = result as { preferences?: Record<string, unknown> } | null;
    const prefs = wrapped?.preferences ?? result ?? {};
    return NextResponse.json(prefs);
  } catch (error) {
    if (error instanceof XanoError) {
      if (error.status === 404) return NextResponse.json({});
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({});
  }
}

export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const result = await xanoFetch<{ success: boolean }>(
      "genie/update-notification-preferences-dev",
      {
        method: "POST",
        authToken,
        body: {
          notify_new_follower:       body.notify_new_follower,
          notify_post_like:          body.notify_post_like,
          notify_post_comment:       body.notify_post_comment,
          notify_going_match:        body.notify_going_match,
          notify_venue_energy_alert: body.notify_venue_energy_alert,
          notify_event_reminder:     body.notify_event_reminder,
          notify_promoter_new_event: body.notify_promoter_new_event,
          notify_new_message:        body.notify_new_message,
          notify_genie_alerts:       body.notify_genie_alerts,
        },
      }
    );

    return NextResponse.json(result ?? { success: true });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not save notification preferences." }, { status: 500 });
  }
}
