import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * POST /api/auth/delete-account
 *
 * Soft-deletes the user account via `genie/ep_delete_account_dev`.
 * Auth is by `external_user_id` (passed in the request body).
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const externalUserId =
      typeof body.external_user_id === "string"
        ? body.external_user_id.trim()
        : "";
    if (!externalUserId) {
      return NextResponse.json(
        { error: "external_user_id is required" },
        { status: 400 }
      );
    }

    const result = await xanoFetch<{
      error: string | null;
      success: boolean;
      message?: string;
    }>("genie/ep_delete_account_dev", {
      method: "POST",
      body: { external_user_id: externalUserId },
      authToken,
    });

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: Boolean(result?.success ?? true),
      message: result?.message ?? "Account has been deleted",
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/auth/delete-account failed:", error);
    return NextResponse.json(
      { error: "Could not delete account." },
      { status: 500 }
    );
  }
}
