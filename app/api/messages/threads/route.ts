import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/messages/threads?page=&per_page=&thread_type=all|producer|user
 * Proxies to: genie/ep_get_threads_dev
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const params = {
      page: request.nextUrl.searchParams.get("page") ?? "1",
      per_page: request.nextUrl.searchParams.get("per_page") ?? "20",
      thread_type: request.nextUrl.searchParams.get("thread_type") ?? "all",
    };

    const result = await xanoFetch("genie/ep_get_threads_dev", {
      authToken,
      params,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not load conversations." }, { status: 500 });
  }
}
