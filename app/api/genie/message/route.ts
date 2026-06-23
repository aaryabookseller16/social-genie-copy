import { NextRequest, NextResponse } from "next/server";

import { type RawGenieVenue } from "@/app/lib/genieTypes";
import { xanoFetch, XanoError, extractBearerToken } from "@/app/lib/server/xanoProxy";
 
function mapPublicVenue(rawVenue: RawGenieVenue) {
  return {
    ...rawVenue,
    image_primary_url:
      rawVenue.image_primary_url ||
      rawVenue.image_fallback_url ||
      rawVenue.image ||
      rawVenue.image_url ||
      null,
  };
}
 
/**
 * POST /api/genie/message
 * Main Genie message handler — proxies to genie/ep_genie_chat_v2_dev
 * Uses Genie base URL (api:pgMKWi2e)
 */
export async function POST(request: NextRequest) {
  try {
    // Forward the Xano JWT when the user is authenticated (same pattern as vendor routes).
    // For guest users this is undefined — Xano handles unauthenticated sessions via session_token.
    const xanoToken = extractBearerToken(request);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const location =
      typeof body.location === "object" && body.location
        ? (body.location as Record<string, unknown>)
        : null;

    const userObj =
      typeof body.user === "object" && body.user
        ? (body.user as Record<string, unknown>)
        : null;

    const resolvedUserName =
      typeof body.user_name === "string"
        ? body.user_name
        : typeof userObj?.first_name === "string"
          ? (userObj.first_name as string)
          : undefined;

    const resolvedExternalUserId =
      typeof body.external_user_id === "string"
        ? body.external_user_id
        : typeof userObj?.user_id === "string"
          ? (userObj.user_id as string)
          : "web_guest";
 
    const upstreamBody = {
      message: String(body.message ?? "").trim(),
      channel: String(body.channel ?? "web"),
      external_user_id: resolvedExternalUserId,
      user_name: resolvedUserName,
      city_context:
        typeof body.city_context === "string" ? body.city_context : undefined,
      session_token:
        typeof body.session_token === "string" ? body.session_token : "",
      lat:
        typeof location?.lat === "number"
          ? location.lat
          : typeof body.lat === "number"
            ? body.lat
            : undefined,
      lng:
        typeof location?.lng === "number"
          ? location.lng
          : typeof body.lng === "number"
            ? body.lng
            : undefined,
      radius_meters:
        typeof body.radius_meters === "number" ? body.radius_meters : 2500,
      location_label:
        typeof body.location_label === "string" ? body.location_label : undefined,
      // v2-specific fields
      session_id:
        typeof body.session_id === "string" ? body.session_id :
        typeof body.session_id === "number" ? String(body.session_id) : undefined,
      session_query_number:
        typeof body.session_query_number === "number" ? body.session_query_number : undefined,
    };
 
    if (!upstreamBody.message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }
 
    const upstreamJson = await xanoFetch<Record<string, unknown>>(
      "genie/ep_genie_chat_v2_dev",
      {
        method: "POST",
        body: upstreamBody,
        authToken: xanoToken,
      }
    );
 
    // ── Normalize venues ──────────────────────────────────────────────────
    // v2 merges primary + more_nearby into a single venues array
    const rawVenues = Array.isArray(upstreamJson.venues)
      ? upstreamJson.venues
      : Array.isArray(upstreamJson.top_venues)
        ? upstreamJson.top_venues
        : [];
 
    const rawMoreVenues = Array.isArray(upstreamJson.more_nearby_venues)
      ? upstreamJson.more_nearby_venues
      : Array.isArray(upstreamJson.more_venues)
        ? upstreamJson.more_venues
        : [];
 
    const allVenues = rawVenues.map((venue) =>
  mapPublicVenue(venue as RawGenieVenue)
);

const venues = allVenues.slice(0, 3);
const moreNearbyVenues = allVenues.slice(3, 15);
 
    // ── Events ────────────────────────────────────────────────────────────
    const events = Array.isArray(upstreamJson.events)
      ? upstreamJson.events
      : [];
 
    // ── Query mode ────────────────────────────────────────────────────────
    const queryMode =
      typeof upstreamJson.query_mode === "string"
        ? upstreamJson.query_mode
        : "venue";
 
    // ── Reply mode ────────────────────────────────────────────────────────
    // For event queries use_xano is false but we still have results
    const replyMode =
      queryMode === "event" && events.length > 0
        ? "has_results"
        : typeof upstreamJson.reply_mode === "string"
          ? upstreamJson.reply_mode
          : typeof upstreamJson.mode === "string"
            ? upstreamJson.mode
            : undefined;
 
    return NextResponse.json({
      reply:
        typeof upstreamJson.reply === "string"
          ? upstreamJson.reply
          : "Here are a few spots with a strong vibe near you.",
      venues: venues.slice(0, 3),
      more_nearby_venues: moreNearbyVenues.slice(0, 12),
      events,
      query_mode: queryMode,
      response_mode: venues.length > 0 || events.length > 0 
    ? "structured_results" 
    : "text_reply",
      session_id:
        typeof upstreamJson.session_id === "number"
          ? upstreamJson.session_id
          : undefined,
      session_token:
        typeof upstreamJson.session_token === "string"
          ? upstreamJson.session_token
          : "",
      use_xano:
  queryMode === "event"
    ? events.length > 0
    : venues.length > 0,
      needs_location: Boolean(upstreamJson.needs_location),
      reply_mode: replyMode,
      filters:
        typeof upstreamJson.filters === "object" && upstreamJson.filters
          ? upstreamJson.filters
          : {},
      debug:
        typeof upstreamJson.debug === "object" && upstreamJson.debug
          ? upstreamJson.debug
          : undefined,
      show_intake_prompt:
        typeof upstreamJson.show_intake_prompt === "boolean"
          ? upstreamJson.show_intake_prompt
          : false,
      intake_prompt_copy:
        typeof upstreamJson.intake_prompt_copy === "string"
          ? upstreamJson.intake_prompt_copy
          : "",
      profile_strength_tier:
        typeof upstreamJson.profile_strength_tier === "string"
          ? upstreamJson.profile_strength_tier
          : undefined,
    });
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/genie/message failed:", error);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
 