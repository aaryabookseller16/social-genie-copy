import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/send-notification
 * Proxies to genie/send_notification
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const userId = Number(body.user_id);
    const notificationType = String(body.notification_type ?? "").trim();
    const title = String(body.title ?? "").trim();
    const message = String(body.message ?? "").trim();
    const url = String(body.url ?? "").trim();

    if (
      !Number.isFinite(userId) ||
      !notificationType ||
      !title ||
      !message ||
      !url
    ) {
      return NextResponse.json(
        {
          error:
            "user_id, notification_type, title, message, and url are required",
        },
        { status: 400 }
      );
    }

    const result = await xanoFetch<{
      success: boolean;
      notification_type: string;
      status: number;
    }>("genie/send_notification", {
      method: "POST",
      body: {
        user_id: userId,
        notification_type: notificationType,
        title,
        message,
        url,
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
    console.error("POST /api/genie/send-notification failed:", error);
    return NextResponse.json(
      { error: "Could not send notification." },
      { status: 500 }
    );
  }
}
