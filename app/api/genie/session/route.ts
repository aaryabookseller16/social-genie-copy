import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/session — create guest session or convert guest to user
 *
 * Create: POST { channel: "web" }
 *   → Xano genie/guest_session
 *   ← { session_token, external_user_id, session_id }
 *
 * Convert: POST { action: "convert", session_token, external_user_id }
 *   → Xano genie/convert_guest_session
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const action = String(body.action ?? "create");

    if (action === "convert") {
      const result = await xanoFetch<{
        converted: boolean;
        session_id: number;
        user_id: number;
        venues_transferred: number;
      }>("genie/convert_guest_session", {
        method: "POST",
        body: {
          session_token: body.session_token ?? "",
          external_user_id: body.external_user_id ?? "",
        },
      });
      return NextResponse.json(result);
    }

    const result = await xanoFetch<{
      session_token: string;
      external_user_id: string;
      session_id: number;
    }>("genie/guest_session", {
      method: "POST",
      body: {
        channel: body.channel ?? "web",
        context: body.context ?? { source: "web" },
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
    console.error("POST /api/genie/session failed:", error);
    return NextResponse.json(
      { error: "Could not create session." },
      { status: 500 }
    );
  }
}
