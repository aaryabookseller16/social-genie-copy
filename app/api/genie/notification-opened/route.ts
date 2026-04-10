import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/notification-opened
 * Proxies to genie/notification_opened
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const notificationId = Number(body.notification_id);
    if (!Number.isFinite(notificationId)) {
      return NextResponse.json(
        { error: "notification_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch<{
      success: boolean;
      notification_id: number;
    }>("genie/notification_opened", {
      method: "POST",
      body: {
        notification_id: notificationId,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/genie/notification-opened failed:", error);
    return NextResponse.json(
      { error: "Could not track notification open." },
      { status: 500 }
    );
  }
}
