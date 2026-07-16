import { NextRequest, NextResponse } from "next/server";
import {
  extractBearerToken,
  toClientError,
  xanoFetch,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/producer/influencer-offers?status=active|pending|rejected|cancelled
 * Returns influencer offers (all statuses, or filtered) for the events the
 * calling producer owns. Owned events are resolved server-side from the JWT.
 * Proxies to: genie/ep_get_producer_pending_offers_dev
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);

    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const status = request.nextUrl.searchParams.get("status")?.trim();
    const params =
      status === "active" ||
      status === "pending" ||
      status === "rejected" ||
      status === "cancelled"
        ? { status }
        : undefined;

    const result = await xanoFetch<{
      success?: boolean;
      error?: string;
      offers?: unknown[];
      count?: number;
    }>("genie/ep_get_producer_pending_offers_dev", {
      authToken,
      params,
    });

    // A caller with no producer profile yet is a normal empty state, not an
    // error the UI should surface. Matched loosely (case-insensitive substring)
    // rather than an exact string so a minor wording change on the backend
    // doesn't silently start surfacing this as a hard error instead.
    if (result.success === false) {
      if (result.error?.toLowerCase().includes("producer profile")) {
        return NextResponse.json({ success: true, offers: [], count: 0 });
      }
      return NextResponse.json(
        { error: result.error ?? "Could not load offers." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toClientError(
      error,
      "Could not load influencer offers."
    );
    return NextResponse.json({ error: message }, { status });
  }
}
