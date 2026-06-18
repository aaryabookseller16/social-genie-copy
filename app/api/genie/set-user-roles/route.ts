import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/set-user-roles
 * Body: { external_user_id: string, roles: string[] }
 * Proxies to: genie/set_user_roles
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const externalUserId = String(body.external_user_id ?? "").trim();
    if (!externalUserId) {
      return NextResponse.json(
        { error: "external_user_id is required" },
        { status: 400 }
      );
    }

    const roles = Array.isArray(body.roles) ? body.roles : [];

    const result = await xanoFetch("set_user_roles", {
      method: "POST",
      body: {
        external_user_id: externalUserId,
        roles,
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
      { error: "Could not save roles." },
      { status: 500 }
    );
  }
}
