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
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    if (body.vendor_id) {
      const result = await xanoFetch<{
        checkout_url: string;
        session_id: string;
      }>("genie/checkout_vendor_plan", {
        method: "POST",
        body: {
          vendor_id: body.vendor_id,
          plan_type: body.plan_type ?? "founding_partner",
          boost_tier: body.boost_tier ?? undefined,
          email: body.email,
          success_url:
            body.success_url ??
            `${appUrl}/?vendor_checkout=success`,
          cancel_url:
            body.cancel_url ??
            `${appUrl}/?vendor_checkout=cancelled`,
        },
      });

      return NextResponse.json({ checkout_url: result.checkout_url });
    }

    const result = await xanoFetch<{
      checkout_url: string;
      session_id: string;
    }>("genie/checkout_vibee", {
      method: "POST",
      body: {
        external_user_id: body.external_user_id ?? "",
        success_url:
          body.success_url ?? "https://www.socialbevy.com/vibee/success",
        cancel_url:
          body.cancel_url ?? "https://www.socialbevy.com/account",
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
