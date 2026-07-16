import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/producer/event
 * Body: { title, category, description?, event_date?, start_time?, end_time?,
 *         venue_name?, venue_address?, city?, cover_image_url?, ticket_url?,
 *         ticket_price_min?, is_free?, age_requirement?, rsvp_limit? }
 * Proxies to genie/ep_create_event_dev, or genie/ep_update_event_dev when an
 * event_id is present. Writes to genie_social_events only. Requires Bearer JWT.
 *
 * `image_urls` is an ordered array of hosted Cloudinary URLs (index 0 is the cover),
 * produced client-side by /api/upload/image. `video_urls` is a separate array of
 * {url, thumbnail_url} pairs, produced client-side by uploadVideo() in
 * app/lib/videoUpload.ts (a direct-to-Cloudinary signed upload, not proxied through this
 * route). Xano caps image_urls + video_urls combined at 5.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const eventId = body.event_id ? Number(body.event_id) : undefined;
    const isEdit = Boolean(eventId);

    const title = String(body.title ?? "").trim();
    const category = String(body.category ?? "").trim();

    // Required to create an event; on edit, ep_update_event_dev patches only the
    // fields it receives, so an images-only edit must not need them.
    if (!isEdit) {
      if (!title) {
        return NextResponse.json({ error: "title is required" }, { status: 400 });
      }
      if (!category) {
        return NextResponse.json({ error: "category is required" }, { status: 400 });
      }
    }

    const payload: Record<string, unknown> = {};
    if (title) payload.title = title;
    if (category) payload.category = category;

    if (body.producer_id) payload.producer_id = Number(body.producer_id);
    if (isEdit) payload.event_id = eventId;
    if (body.description) payload.description = String(body.description).trim();
    if (body.event_date) payload.event_date = String(body.event_date).trim();
    if (body.start_time) payload.start_time = String(body.start_time).trim();
    if (body.end_time) payload.end_time = String(body.end_time).trim();
    if (body.venue_id) payload.venue_id = Number(body.venue_id);
    if (body.venue_name) payload.venue_name = String(body.venue_name).trim();
    if (body.venue_address) payload.venue_address = String(body.venue_address).trim();
    if (body.city) payload.city = String(body.city).trim();
    if (body.cover_image_url) payload.cover_image_url = String(body.cover_image_url).trim();
    // Xano can't tell an empty array from an absent one, so removing every image
    // needs the explicit flag rather than `image_urls: []`. Only the update
    // endpoint understands it — on create there is nothing to clear.
    if (Array.isArray(body.image_urls)) {
      const urls = body.image_urls.filter(
        (url): url is string => typeof url === "string" && url.trim().length > 0
      );
      if (urls.length > 0) payload.image_urls = urls;
      else if (isEdit) payload.clear_images = true;
    }
    // Same replace-whole-array semantics as image_urls, in a separate list — the combined
    // count is validated by Xano, not here.
    if (Array.isArray(body.video_urls)) {
      const videos = body.video_urls.filter(
        (v): v is { url: string; thumbnail_url: string } =>
          !!v &&
          typeof v === "object" &&
          typeof (v as Record<string, unknown>).url === "string" &&
          typeof (v as Record<string, unknown>).thumbnail_url === "string"
      );
      if (videos.length > 0) payload.video_urls = videos;
      else if (isEdit) payload.clear_video = true;
    }
    if (body.ticket_url) payload.ticket_url = String(body.ticket_url).trim();
    if (body.ticket_price_min !== undefined) payload.ticket_price_min = Number(body.ticket_price_min) || 0;
    if (body.is_free !== undefined) payload.is_free = Boolean(body.is_free);
    if (body.age_requirement) payload.age_requirement = String(body.age_requirement).trim();
    if (body.rsvp_limit !== undefined) payload.rsvp_limit = Number(body.rsvp_limit) || undefined;

    const endpoint = isEdit ? "genie/ep_update_event_dev" : "genie/ep_create_event_dev";

    const result = await xanoFetch(endpoint, {
      method: "POST",
      authToken,
      body: payload,
    });

    console.log(`[producer/event POST] ${endpoint} response:`, JSON.stringify(result));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not save event." }, { status: 500 });
  }
}
