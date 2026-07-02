import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const result = await xanoFetch<{ unread_count?: number }>(
      "genie/get-unread-notifications-count-dev",
      { authToken }
    );
    return NextResponse.json({ unread_count: result.unread_count ?? 0 });
  } catch (error) {
    if (error instanceof XanoError) {
      if (error.status === 404) {
        return NextResponse.json({ unread_count: 0 });
      }
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ unread_count: 0 });
  }
}
