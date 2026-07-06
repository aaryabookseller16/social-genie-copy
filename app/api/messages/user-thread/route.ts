import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/messages/user-thread?thread_id=&page=&per_page=
 * Proxies to: genie/ep_get_user_messages_dev (user <-> user threads only)
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const threadId = request.nextUrl.searchParams.get("thread_id");
    if (!threadId || isNaN(Number(threadId))) {
      return NextResponse.json({ error: "thread_id is required" }, { status: 400 });
    }

    const params = {
      thread_id: threadId,
      page: request.nextUrl.searchParams.get("page") ?? "1",
      per_page: request.nextUrl.searchParams.get("per_page") ?? "30",
    };

    const result = await xanoFetch("genie/ep_get_user_messages_dev", {
      authToken,
      params,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not load conversation." }, { status: 500 });
  }
}
