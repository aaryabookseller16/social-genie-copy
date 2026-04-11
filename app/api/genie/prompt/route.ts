import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/prompt?external_user_id=X&session_token=Y — should show prompt?
 * POST /api/genie/prompt — log event or dismiss
 *
 * Maps to:
 *   genie/prompt_should_show (GET)
 *   genie/prompt_log_event (POST action=log_event)
 *   genie/prompt_dismiss (POST action=dismiss)
 */
export async function GET(request: NextRequest) {
  try {
    const externalUserId =
      request.nextUrl.searchParams.get("external_user_id") ?? "";
    const sessionToken =
      request.nextUrl.searchParams.get("session_token") ?? "";

    if (!externalUserId) {
      return NextResponse.json({ should_show: false });
    }

    const params: Record<string, string> = {
      external_user_id: externalUserId,
    };
    if (sessionToken) params.session_token = sessionToken;

    const result = await xanoFetch<{
      should_show: boolean;
      prompt_type?: string;
      reason: string;
    }>("genie/prompt_should_show", { params });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ should_show: false });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const action = String(body.action ?? "log_event");

    if (action === "dismiss") {
      const result = await xanoFetch("genie/prompt_dismiss", {
        method: "POST",
        body: {
          external_user_id: body.external_user_id ?? "",
          session_token: body.session_token ?? "",
        },
      });
      return NextResponse.json(result);
    }

    const result = await xanoFetch("genie/prompt_log_event", {
      method: "POST",
      body: {
        external_user_id: body.external_user_id ?? "",
        session_token: body.session_token ?? "",
        event_type: body.event_type ?? body.trigger_event ?? "shown",
        prompt_type: body.prompt_type ?? "signup_nudge",
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
    return NextResponse.json({ success: true });
  }
}
