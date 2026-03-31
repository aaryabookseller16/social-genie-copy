import { NextRequest, NextResponse } from "next/server";

import { type RawGenieVenue } from "@/app/lib/genieTypes";
import { getAuthenticatedUser } from "@/app/lib/server/requestAuth";

const XANO_BASE_URL = process.env.XANO_BASE_URL || "";
const XANO_HANDLE_MESSAGE_PATH =
  process.env.XANO_GENIE_HANDLE_MESSAGE_PATH || "";

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
        typeof body.radius_meters === "number" ? body.radius_meters : 8047,
      location_label:
        typeof body.location_label === "string" ? body.location_label : undefined,
    };

    if (!upstreamBody.message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    if (!XANO_BASE_URL || !XANO_HANDLE_MESSAGE_PATH) {
      return NextResponse.json(
        { error: "Xano configuration is missing" },
        { status: 500 }
      );
    }

    const upstreamUrl = new URL(XANO_HANDLE_MESSAGE_PATH, XANO_BASE_URL);
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upstreamBody),
      cache: "no-store",
    });

    const upstreamJson = (await upstreamResponse.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (!upstreamResponse.ok || !upstreamJson) {
      return NextResponse.json(
        { error: "Failed to process Genie message" },
        { status: upstreamResponse.status || 500 }
      );
    }

    const decisive = Array.isArray(upstreamJson.top_venues)
      ? upstreamJson.top_venues.map((venue) =>
          mapPublicVenue(venue as RawGenieVenue)
        )
      : [];
    const moreNearby = Array.isArray(upstreamJson.more_venues)
      ? upstreamJson.more_venues.map((venue) =>
          mapPublicVenue(venue as RawGenieVenue)
        )
      : [];

    return NextResponse.json({
      reply:
        typeof upstreamJson.reply === "string"
          ? upstreamJson.reply
          : "Here are a few spots with a strong vibe near you.",
      decisive: decisive.slice(0, 3),
      more_nearby: moreNearby.slice(0, 12),
      session_token:
        typeof upstreamJson.session_token === "string"
          ? upstreamJson.session_token
          : "",
      use_xano: Boolean(upstreamJson.use_xano),
      needs_location: Boolean(upstreamJson.needs_location),
      debug:
        typeof upstreamJson.debug === "object" && upstreamJson.debug
          ? upstreamJson.debug
          : undefined,
    });
  } catch (error) {
    console.error("POST /api/genie/message failed:", error);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
