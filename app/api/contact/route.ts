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
 * Submits a contact-form message.
 *
 * Transport priority:
 *   1. If `GENIE_CONTACT_WEBHOOK_URL` env var is set, POST the payload to that
 *      webhook (useful for Zapier / Make / custom mail relay).
 *   2. Otherwise, forward the payload to Xano `genie/contact_submit`
 *      (forward-compatible — backend team can expose this endpoint when ready).
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
    const subject = String(body.subject ?? "").trim();
    const description = String(body.description ?? "").trim();

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
    if (!description) {
      return NextResponse.json(
        { error: "Please include a short description." },
        { status: 400 }
      );
    }

    const authToken = extractBearerToken(request);

    const payload = {
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      email,
      subject: subject || undefined,
      description,
      submitted_at: new Date().toISOString(),
    };

    const webhookUrl = process.env.GENIE_CONTACT_WEBHOOK_URL;
    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Contact webhook failed", res.status, text);
        return NextResponse.json(
          { error: "Could not deliver your message. Please try again." },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Thanks — we'll get back to you shortly.",
      });
    }

    const result = await xanoFetch<{
      success?: boolean;
      message?: string;
      Message?: string;
    }>("genie/contact_submit", {
      method: "POST",
      body: payload,
      authToken,
    });

    return NextResponse.json({
      success: result.success ?? true,
      message:
        result.Message ||
        result.message ||
        "Thanks — we'll get back to you shortly.",
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
