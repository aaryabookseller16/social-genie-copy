import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/messages/report
 * Body: { content_type: string, content_id: number, report_reason: string, report_details?: string }
 * Proxies to: genie/ep_report_content_dev
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const result = await xanoFetch("genie/ep_report_content_dev", {
      method: "POST",
      authToken,
      body,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not submit report." }, { status: 500 });
  }
}
