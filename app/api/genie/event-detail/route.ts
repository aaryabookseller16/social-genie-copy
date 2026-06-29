import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get("event_id");
    if (!eventId || isNaN(Number(eventId))) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    }

    const authToken = extractBearerToken(request);

    const result = await xanoFetch("genie/ep_get_event_detail_dev", {
      params: { event_id: eventId },
      ...(authToken ? { authToken } : {}),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not load event detail." }, { status: 500 });
  }
}
