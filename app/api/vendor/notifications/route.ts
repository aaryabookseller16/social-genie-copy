import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/vendor/notifications?external_user_id=X
 * Fetch current notification preferences.
 * Proxies to genie/get-notification-preferences-dev
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const externalUserId =
      request.nextUrl.searchParams.get("external_user_id") ?? "";

    if (!externalUserId) {
      return NextResponse.json(
        { error: "external_user_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch(
      "genie/get-notification-preferences-dev",
      {
        authToken,
        params: { external_user_id: externalUserId },
      }
    );

    return NextResponse.json(result ?? {});
  } catch (error) {
    if (error instanceof XanoError) {
      if (error.status === 404) {
        return NextResponse.json({});
      }
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("GET /api/vendor/notifications failed:", error);
    return NextResponse.json({});
  }
}

/**
 * POST /api/vendor/notifications
 * Save notification preferences.
 * Body: { external_user_id, email_notifications, push_notifications, sms_notifications, sms_phone }
 * Proxies to genie/update-notification-preferences-dev
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!body.external_user_id) {
      return NextResponse.json(
        { error: "external_user_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch<{ success: boolean }>(
      "genie/update-notification-preferences-dev",
      {
        method: "POST",
        authToken,
        body: {
          external_user_id: body.external_user_id,
          email_notifications: body.email_notifications,
          push_notifications: body.push_notifications,
          sms_notifications: body.sms_notifications,
          sms_phone: body.sms_phone,
        },
      }
    );

    return NextResponse.json(result ?? { success: true });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/vendor/notifications failed:", error);
    return NextResponse.json(
      { error: "Could not save notification preferences." },
      { status: 500 }
    );
  }
}
