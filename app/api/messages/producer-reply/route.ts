import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/messages/producer-reply
 * Body: { thread_id: number, message_text: string }
 * Proxies to: genie/ep_producer_reply_dev — the producer-owner side of a
 * business thread replies here, not through ep_send_message_dev.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const result = await xanoFetch("genie/ep_producer_reply_dev", {
      method: "POST",
      authToken,
      body,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not send reply." }, { status: 500 });
  }
}
