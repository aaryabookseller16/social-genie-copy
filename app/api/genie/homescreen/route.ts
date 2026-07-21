import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, toClientError } from "@/app/lib/server/xanoProxy";

/**
 * GET /api/genie/homescreen
 * Proxies to genie/ep_get_homescreen_dev — the homescreen's first paint
 * (location + weather + page 1 of the venue and event rails + placements +
 * neighborhoods). Subsequent pages come from /api/genie/trending-venues and
 * /api/genie/homescreen-events, never from here.
 *
 * Every param is optional and only forwarded when present: the backend
 * resolves the city from lat/lng itself and falls back to Houston, so sending
 * a hardcoded city_id would override a real GPS fix. `city_name` is ignored
 * server-side (the canonical name comes from the cities table) and is not sent.
 */
/** Keep only `fields` from each row, dropping everything else. */
function pick(rows: unknown, fields: string[]): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const source = (row ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in source) out[field] = source[field];
    }
    return out;
  });
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const params: Record<string, string> = {};
    for (const key of ["city_id", "user_id", "lat", "lng"]) {
      const value = sp.get(key);
      if (value) params[key] = value;
    }

    const result = await xanoFetch<Record<string, unknown>>(
      "genie/ep_get_homescreen_dev",
      { params }
    );

    // Xano returns these two as raw table rows with no projection, and this
    // endpoint is public — so whatever the columns hold is broadcast to every
    // unauthenticated visitor. Whitelist the fields the UI actually renders:
    //
    //  - vendor_placements carries revenue, cpm, cpc, budget_total,
    //    budget_spent, payment_status, invoice_id and vendor_user_id. That is
    //    vendors' commercial data and must never reach the browser.
    //  - neighborhoods carries the full census block (median income, racial
    //    composition, population density) plus boundary polygons — sensitive
    //    to broadcast and by far the largest part of the payload.
    //
    // The real fix is a projection in fn_genie_get_homescreen_data_dev; this
    // is the same defensive strip venue-checkins/route.ts does for its rows.
    return NextResponse.json({
      ...result,
      active_placements: pick(result.active_placements, [
        "id",
        "venue_id",
        "placement_type",
        "creative_url",
        "creative_title",
        "creative_description",
      ]),
      top_neighborhoods: pick(result.top_neighborhoods, [
        "id",
        "name",
        "social_energy_state",
        "social_energy_score",
        "venue_count",
        "vibe_description",
      ]),
    });
  } catch (error) {
    const { status, message } = toClientError(error, "Could not load homescreen.");
    return NextResponse.json({ error: message }, { status });
  }
}
