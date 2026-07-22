import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/subscription/create
 * Creates Stripe checkout sessions via Xano.
 *
 * Vendor plan: genie/checkout_vendor_plan
 * V.I.Bee consumer: genie/checkout_vibee
 */
export async function POST(request: NextRequest) {
  try {
    const appBase =
      process.env.NEXT_PUBLIC_APP_BASE_URL ||
      process.env.APP_BASE_URL ||
      "https://genie.socialbevy.com";
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (body.vendor_id) {
      const planType = String(body.plan_type ?? "founding_partner");
      const result = await xanoFetch<{
        checkout_url: string;
        session_id: string;
        plan_type?: string;
        mode?: string;
      }>("genie/checkout_vendor_plan", {
        method: "POST",
        body: {
          vendor_id: body.vendor_id,
          plan_type: planType,
          boost_tier: body.boost_tier ?? undefined,
          success_url:
            body.success_url ??
            `${appBase}/vendor/success?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(planType)}`,
          cancel_url: body.cancel_url ?? `${appBase}/?checkout=cancel`,
        },
      });

      return NextResponse.json({
        checkout_url: result.checkout_url,
        session_id: result.session_id,
        plan_type: result.plan_type,
        mode: result.mode,
      });
    }

    // `email` is a required input on checkout_vibee, and Xano rejects an empty
    // string exactly as it rejects an absent key ("Missing param: email").
    // Fail here with something actionable rather than proxying a doomed call.
    const email = String(body.email ?? "").trim();
    if (!email) {
      return NextResponse.json(
        { error: "Sign in before upgrading — checkout needs your email." },
        { status: 400 }
      );
    }

    const result = await xanoFetch<{
      checkout_url: string;
      session_id: string;
    }>("genie/checkout_vibee", {
      method: "POST",
      body: {
        external_user_id: body.external_user_id ?? "",
        email,
        success_url:
          body.success_url ??
          `${appBase}/vibee/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: body.cancel_url ?? `${appBase}/?checkout=cancel`,
      },
    });

    return NextResponse.json({ checkout_url: result.checkout_url });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/subscription/create failed:", error);
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 500 }
    );
  }
}
