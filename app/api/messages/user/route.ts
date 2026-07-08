import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/messages/user
 * Body: { recipient_id: number, message_text: string }
 * Proxies to: genie/ep_send_user_message_dev
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const result = await xanoFetch("genie/ep_send_user_message_dev", {
      method: "POST",
      authToken,
      body,
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(error, "Could not send message.");
    return NextResponse.json({ error: message }, { status });
  }
}
