import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/messages/mark-read
 * Body: { thread_id: number, thread_type: "producer" | "user" }
 * Proxies to: genie/ep_mark_thread_read_dev — zeroes the caller's own unread
 * counter for the given thread (leaves the counterpart's count untouched).
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const result = await xanoFetch("genie/ep_mark_thread_read_dev", {
      method: "POST",
      authToken,
      body,
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not mark thread as read.");
    return NextResponse.json({ error: message }, { status });
  }
}
