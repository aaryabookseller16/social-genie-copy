import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/producer/event
 * Body: { title, category, description?, event_date?, start_time?, end_time?,
 *         venue_name?, venue_address?, city?, cover_image_url?, ticket_url?,
 *         ticket_price_min?, is_free?, age_requirement?, rsvp_limit? }
 * Proxies to: genie/ep_create_event_dev  → writes to genie_social_events only.
 * Requires Bearer JWT.
 *
 * TODO: confirm whether ep_create_event_dev accepts an event_id field for updates,
 * or if a separate update endpoint exists. For now, POST handles both create and edit.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const category = String(body.category ?? "").trim();
    if (!category) {
      return NextResponse.json({ error: "category is required" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      title,
      category,
    };

    if (body.producer_id) payload.producer_id = Number(body.producer_id);
    if (body.event_id) payload.event_id = Number(body.event_id);
    if (body.description) payload.description = String(body.description).trim();
    if (body.event_date) payload.event_date = String(body.event_date).trim();
    if (body.start_time) payload.start_time = String(body.start_time).trim();
    if (body.end_time) payload.end_time = String(body.end_time).trim();
    if (body.venue_name) payload.venue_name = String(body.venue_name).trim();
    if (body.venue_address) payload.venue_address = String(body.venue_address).trim();
    if (body.city) payload.city = String(body.city).trim();
    if (body.cover_image_url) payload.cover_image_url = String(body.cover_image_url).trim();
    if (body.ticket_url) payload.ticket_url = String(body.ticket_url).trim();
    if (body.ticket_price_min !== undefined) payload.ticket_price_min = Number(body.ticket_price_min) || 0;
    if (body.is_free !== undefined) payload.is_free = Boolean(body.is_free);
    if (body.age_requirement) payload.age_requirement = String(body.age_requirement).trim();
    if (body.rsvp_limit !== undefined) payload.rsvp_limit = Number(body.rsvp_limit) || undefined;

    const result = await xanoFetch("genie/ep_create_event_dev", {
      method: "POST",
      authToken,
      body: payload,
    });

    console.log("[producer/event POST] Xano response:", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not save event." }, { status: 500 });
  }
}
