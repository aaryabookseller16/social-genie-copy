import { NextRequest, NextResponse } from "next/server";
import { xanoFetch } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/interaction — log vendor interaction
 * Fire-and-forget from frontend for vendor dashboard metrics.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const result = await xanoFetch<{
      logged: boolean;
      interaction_type: string;
      venue_id: number;
    }>("genie/vendor_log_interaction", {
      method: "POST",
      body: {
        venue_id: body.venue_id,
        interaction_type: body.interaction_type,
        user_id: body.user_id ?? 0,
        session_id: body.session_id ?? 0,
      },
    });

    return NextResponse.json(result);
  } catch {
    // fire-and-forget — never fail the user
    return NextResponse.json({ logged: true });
  }
}
