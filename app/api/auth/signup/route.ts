import { NextRequest, NextResponse } from "next/server";
import { xanoAuthFetch, XanoError } from "@/app/lib/server/xanoProxy";

function isEmailValid(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

/**
 * POST /api/auth/signup
 * Magic link signup — sends email with magic link.
 * Uses Auth base URL (api:q_bU9d5K) → auth/verify_email/signup
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
    const intent = body.intent === "login" ? "login" : "signup";
    const referralCode = String(body.referral_code ?? "").trim() || undefined;

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

    const result = await xanoAuthFetch<{ success?: boolean; message?: string; Message?: string }>(
      "auth/verify_email/signup",
      {
        method: "POST",
        body: {
          email,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          intent,
          referral_code: referralCode,
        },
      }
    );

    return NextResponse.json({
      success: result.success ?? true,
      message:
        result.Message ||
        result.message ||
        "Check your email for a magic link to complete your account!",
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/auth/signup failed:", error);
    return NextResponse.json(
      { error: "Could not create your account." },
      { status: 500 }
    );
  }
}
