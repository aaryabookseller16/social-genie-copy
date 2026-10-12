import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/user-context?device_id=...&external_user_id=...
 * POST /api/genie/user-context  (quick-pick onboarding result)
 * Proxies to:
 *   genie/ep_get_user_context_dev
 *   genie/ep_save_quick_picks_dev
 */
export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get("device_id")?.trim() ?? "";
    const externalUserId =
      request.nextUrl.searchParams.get("external_user_id")?.trim() ?? "";

    if (!deviceId && !externalUserId) {
      return NextResponse.json(
        { error: "device_id or external_user_id is required" },
        { status: 400 }
      );
    }

    const params: Record<string, string> = {};
    if (externalUserId) {
      params.external_user_id = externalUserId;
    }
    if (deviceId) {
      params.device_id = deviceId;
    }

    const result = await xanoFetch("genie/ep_get_user_context_dev", { params });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Could not load user context." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const deviceId = String(body.device_id ?? "").trim();
    const externalUserId = String(body.external_user_id ?? "").trim();
    if (!deviceId && !externalUserId) {
      return NextResponse.json(
        { error: "device_id or external_user_id is required" },
        { status: 400 }
      );
    }

    const status = String(body.status ?? "").trim();
    if (status !== "completed" && status !== "skipped") {
      return NextResponse.json(
        { error: "status must be completed or skipped" },
        { status: 400 }
      );
    }

    const result = await xanoFetch("genie/ep_save_quick_picks_dev", {
      method: "POST",
      body: {
        device_id: deviceId || undefined,
        external_user_id: externalUserId || undefined,
        status,
        card_ids: Array.isArray(body.card_ids) ? body.card_ids : [],
        picks: Array.isArray(body.picks) ? body.picks : [],
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Could not save onboarding picks." },
      { status: 500 }
    );
  }
}
