import { NextRequest, NextResponse } from "next/server";
import {
  xanoFetch,
  extractBearerToken,
  XanoError,
} from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/influencer-dashboard
 * Returns normalized stats + offers for the logged-in influencer.
 * Proxies to: genie/ep_get_influencer_dashboard_dev
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);

    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const raw = await xanoFetch<{
      success: boolean;
      stats: {
        total_redemptions?: number;
        offer_redemptions?: number;
        total_commission_earned?: number;
        total_referrals?: number;
        referral_signups?: number;
        pending_commission?: number;
        paid_commission?: number;
      };
      offers?: Array<{ status?: string; [key: string]: unknown }>;
      recent_redemptions?: unknown[];
      landing_url?: string;
      referral_url?: string;
    }>("genie/ep_get_influencer_dashboard_dev", { authToken });

    const offers = raw.offers ?? [];
    const activeCodesCount = offers.filter((o) => o.status === "active").length;

    return NextResponse.json({
      active_codes_count: activeCodesCount,
      total_redemptions: raw.stats?.total_redemptions ?? raw.stats?.offer_redemptions ?? 0,
      total_commission_earned: raw.stats?.total_commission_earned ?? 0,
      referral_signups: raw.stats?.total_referrals ?? raw.stats?.referral_signups ?? 0,
      pending_commission: raw.stats?.pending_commission ?? 0,
      paid_commission: raw.stats?.paid_commission ?? 0,
      offers,
      landing_url: raw.landing_url,
      referral_url: raw.referral_url,
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Could not load influencer dashboard." },
      { status: 500 }
    );
  }
}
