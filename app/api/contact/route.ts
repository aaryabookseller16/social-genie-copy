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
 * POST /api/contact
 *
 * Submits a contact-form message to the Xano contact endpoint:
 * /api:pgMKWi2e/genie/ep_contact_us_dev
 *
 * Auth token (if present) is attached so the backend can associate the message
 * with the signed-in user; anonymous submissions are also accepted.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const topic = String(body.topic ?? body.subject ?? "").trim();
    const message = String(body.message ?? body.description ?? "").trim();
    const source = String(body.source ?? "app").trim() || "app";

    if (!firstName) {
      return NextResponse.json(
        { error: "first_name is required" },
        { status: 400 }
      );
    }
    if (!lastName) {
      return NextResponse.json(
        { error: "last_name is required" },
        { status: 400 }
      );
    }
    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }
    if (!isEmailValid(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }
    if (!topic) {
      return NextResponse.json(
        { error: "topic is required" },
        { status: 400 }
      );
    }
    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const authToken = extractBearerToken(request);

    const payload = {
      first_name: firstName,
      last_name: lastName,
      email,
      topic,
      message,
      source,
    };

    const result = (await xanoFetch<{
      success?: boolean;
      message?: string;
      Message?: string;
    } | null>("genie/ep_contact_us_dev", {
      method: "POST",
      body: payload,
      authToken,
    })) ?? {};

    return NextResponse.json({
      success: result.success ?? true,
      message:
        result.Message ||
        result.message ||
        "Thanks - we'll get back to you shortly.",
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/contact failed:", error);
    return NextResponse.json(
      { error: "Could not submit your message." },
      { status: 500 }
    );
  }
}
