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
    const appBase = "https://genie.socialbevy.com";
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (body.vendor_id) {
      const result = await xanoFetch<{
        checkout_url: string;
        session_id: string;
        plan_type?: string;
        mode?: string;
      }>("genie/checkout_vendor_plan", {
        method: "POST",
        body: {
          vendor_id: body.vendor_id,
          plan_type: body.plan_type ?? "founding_partner",
          boost_tier: body.boost_tier ?? undefined,
          success_url: body.success_url ?? `${appBase}/?checkout=success`,
          cancel_url:
            body.cancel_url ??
            "https://genie.socialbevy.com/vendor",
        },
      });

      return NextResponse.json({
        checkout_url: result.checkout_url,
        session_id: result.session_id,
        plan_type: result.plan_type,
        mode: result.mode,
      });
    }

    const result = await xanoFetch<{
      checkout_url: string;
      session_id: string;
    }>("genie/checkout_vibee", {
      method: "POST",
      body: {
        external_user_id: body.external_user_id ?? "",
        success_url: body.success_url ?? `${appBase}/?checkout=success`,
        cancel_url:
          body.cancel_url ?? "https://genie.socialbevy.com/account",
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
