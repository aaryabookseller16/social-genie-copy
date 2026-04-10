import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/register-push-token
 * Proxies to genie/register_push_token
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const externalUserId = String(body.external_user_id ?? "").trim();
    const playerId = String(body.onesignal_player_id ?? "").trim();
    const channel = String(body.channel ?? "web").trim();

    if (!externalUserId || !playerId || !channel) {
      return NextResponse.json(
        {
          error:
            "external_user_id, onesignal_player_id, and channel are required",
        },
        { status: 400 }
      );
    }

    const result = await xanoFetch<{
      success: boolean;
      message: string;
      user_id?: number;
      channel?: string;
    }>("genie/register_push_token", {
      method: "POST",
      body: {
        external_user_id: externalUserId,
        onesignal_player_id: playerId,
        channel,
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
    console.error("POST /api/genie/register-push-token failed:", error);
    return NextResponse.json(
      { error: "Could not register push token." },
      { status: 500 }
    );
  }
}
