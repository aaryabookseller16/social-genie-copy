import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

function isEmailValid(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

/**
 * POST /api/vendor/contact-info
 *
 * Updates the VENDOR contact info (V-05 Vendor Contact Info screen).
 * Proxies to Xano Genie base (api:pgMKWi2e) →
 * `genie/ep_save_contact_info_dev`.
 *
 * Auth is by `external_user_id` (passed in the request body). Only the
 * provided fields are updated — omitted fields retain their current values.
 *
 * Note: this endpoint requires the user to already have a `genie_vendor`
 * row linked. Consumer users without a vendor profile will receive
 * `"Vendor profile not found"` from the upstream endpoint.
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

    const payload: Record<string, string> = {
      external_user_id: externalUserId,
    };

    if (body.first_name !== undefined) {
      payload.first_name = String(body.first_name).trim();
    }
    if (body.last_name !== undefined) {
      payload.last_name = String(body.last_name).trim();
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (email && !isEmailValid(email)) {
        return NextResponse.json(
          { error: "Invalid email address" },
          { status: 400 }
        );
      }
      payload.email = email;
    }
    if (body.phone !== undefined) {
      payload.phone = String(body.phone).trim();
    }

    if (Object.keys(payload).length <= 1) {
      return NextResponse.json(
        { error: "No contact fields provided." },
        { status: 400 }
      );
    }

    const result = await xanoFetch<{
      error: string | null;
      success: boolean;
    }>("genie/ep_save_contact_info_dev", {
      method: "POST",
      body: payload,
      authToken,
    });

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: Boolean(result?.success ?? true),
      vendor: {
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone: payload.phone ?? null,
      },
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/vendor/contact-info failed:", error);
    return NextResponse.json(
      { error: "Could not save vendor contact info." },
      { status: 500 }
    );
  }
}
