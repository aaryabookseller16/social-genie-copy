import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/producer/audience-analytics
 * Proxies to: genie/get-promoter-audience-analytics-dev
 * Requires Bearer JWT.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);

    const result = await xanoFetch("genie/get-promoter-audience-analytics-dev", {
      authToken,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not fetch audience analytics." }, { status: 500 });
  }
}
