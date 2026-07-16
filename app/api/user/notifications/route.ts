import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    // Xano's get-notifications-dev requires page (min 1) — the documented default
    // isn't applied server-side, so always pass explicit pagination.
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") ?? "1";
    const perPage = searchParams.get("per_page") ?? "20";
    const result = await xanoFetch("genie/get-notifications-dev", {
      authToken,
      params: { page, per_page: perPage },
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      if (error.status === 404) {
        return NextResponse.json({ notifications: [], unread_count: 0 });
      }
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ notifications: [], unread_count: 0 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { notification_ids } = (await request.json()) as {
      notification_ids: number[];
    };
    await xanoFetch("genie/mark-notifications-read-dev", {
      method: "POST",
      authToken,
      body: { notification_ids },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not mark notifications as read." }, { status: 500 });
  }
}
