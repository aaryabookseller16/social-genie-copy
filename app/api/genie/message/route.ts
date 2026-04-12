import { NextRequest, NextResponse } from "next/server";

import { type RawGenieVenue } from "@/app/lib/genieTypes";
import { getAuthenticatedUser } from "@/app/lib/server/requestAuth";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

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
 * Main Genie message handler — proxies to genie/ep_handle_message_dev
 * Uses Genie base URL (api:pgMKWi2e)
 */
export async function POST(request: NextRequest) {
  try {
    // Optional auth: enrich with user context when JWT is present
    const auth = await getAuthenticatedUser(request);

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const location =
      typeof body.location === "object" && body.location
        ? (body.location as Record<string, unknown>)
        : null;

    // Extract nested user object fields (user.first_name, user.user_id)
    const userObj =
      typeof body.user === "object" && body.user
        ? (body.user as Record<string, unknown>)
        : null;

    // Resolve user_name: explicit body field > nested user.first_name > JWT user
    const resolvedUserName =
      typeof body.user_name === "string"
        ? body.user_name
        : typeof userObj?.first_name === "string"
          ? (userObj.first_name as string)
          : auth?.user.first_name ?? undefined;

    // Resolve external_user_id: explicit body field > nested user.user_id > JWT user id
    const resolvedExternalUserId =
      typeof body.external_user_id === "string"
        ? body.external_user_id
        : typeof userObj?.user_id === "string"
          ? (userObj.user_id as string)
          : auth
            ? String(auth.user.id)
            : "web_guest";

    const upstreamBody = {
      message: String(body.message ?? "").trim(),
      channel: String(body.channel ?? "web"),
      external_user_id: resolvedExternalUserId,
      user_name: resolvedUserName,
      city_context:
        typeof body.city_context === "string" ? body.city_context : "Houston",
      session_token:
        typeof body.session_token === "string" ? body.session_token : "",
      user_data:
        typeof body.user_data === "object" && body.user_data
          ? body.user_data
          : {},
      meta:
        typeof body.meta === "object" && body.meta
          ? body.meta
          : {},
      debug: Boolean(body.debug),
      entry_point:
        typeof body.entry_point === "string" ? body.entry_point : undefined,
      entry_context_id:
        typeof body.entry_context_id === "string" || body.entry_context_id === null
          ? body.entry_context_id
          : null,
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
    };

    if (!upstreamBody.message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const upstreamJson = await xanoFetch<Record<string, unknown>>(
      "genie/ep_handle_message_dev",
      {
        method: "POST",
        body: upstreamBody,
      }
    );

    const topVenues = Array.isArray(upstreamJson.top_venues)
      ? upstreamJson.top_venues.map((venue) =>
          mapPublicVenue(venue as RawGenieVenue)
        )
      : [];
    const moreVenues = Array.isArray(upstreamJson.more_venues)
      ? upstreamJson.more_venues.map((venue) =>
          mapPublicVenue(venue as RawGenieVenue)
        )
      : [];

    return NextResponse.json({
      reply:
        typeof upstreamJson.reply === "string"
          ? upstreamJson.reply
          : "Here are a few spots with a strong vibe near you.",
      top_venues: topVenues.slice(0, 3),
      more_venues: moreVenues.slice(0, 12),
      session_id:
        typeof upstreamJson.session_id === "number"
          ? upstreamJson.session_id
          : undefined,
      session_token:
        typeof upstreamJson.session_token === "string"
          ? upstreamJson.session_token
          : "",
      use_xano: Boolean(upstreamJson.use_xano),
      needs_location: Boolean(upstreamJson.needs_location),
      reply_mode:
        typeof upstreamJson.reply_mode === "string"
          ? upstreamJson.reply_mode
          : typeof upstreamJson.mode === "string"
            ? upstreamJson.mode
            : undefined,
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
