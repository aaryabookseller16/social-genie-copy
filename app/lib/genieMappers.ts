import {
  type GenieResponseEnvelope,
  type GenieResponseMode,
  type GenieVenue,
  type RawGenieVenue,
  type RawHandleMessageResponse,
} from "./genieTypes";
import { toImageList } from "./image";
// Type-only: keeps this module importable from server components, which
// publicApiClient's browser-side helpers are not.
import type { NearbyVenue } from "./publicApiClient";

export function getVenueImage(rawVenue: RawGenieVenue): string | null {
  const candidates = [
    rawVenue.image_primary_url,
    rawVenue.image_fallback_url,
    rawVenue.image,
    rawVenue.image_url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

function normalizeCoordinate(value: RawGenieVenue["latitude"]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function mapVenue(rawVenue: RawGenieVenue): GenieVenue {
  const normalizedImage = getVenueImage(rawVenue);

  return {
    ...rawVenue,
    image: normalizedImage,
    image_url: normalizedImage,
    // Xano returns an empty json column as `{}`, and older callers omit it entirely.
    image_urls: toImageList(rawVenue.image_urls),
    latitude: normalizeCoordinate(rawVenue.latitude),
    longitude: normalizeCoordinate(rawVenue.longitude),
  };
}

/**
 * Adapts a card from ep_get_nearby_venues_dev onto the GenieVenue shape so the
 * shared venue card and its helpers (getVenueHeadlineShort, getVenueStatus, ...)
 * can render it unchanged.
 *
 * `social_energy_state` is deliberately not carried over: the nearby payload
 * sends lowercase `"quiet"` while SOCIAL_ENERGY_STATUS is keyed on `"Quiet"` /
 * `"Buzzing"` / ..., and the field is inert anyway. Leaving it undefined lets
 * the status helpers fall through to their own copy.
 *
 * Empty strings are normalized to null — `price_band` and `reservation_url` come
 * back as `""` rather than null on some rows.
 */
export function nearbyVenueToGenieVenue(venue: NearbyVenue): GenieVenue {
  const blankToNull = (value: string | null) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };
  const image = blankToNull(venue.image_url);

  return {
    id: venue.id,
    venue_name: venue.name,
    address: blankToNull(venue.address),
    area_neighborhood: blankToNull(venue.neighborhood),
    vibe_notes: blankToNull(venue.short_description),
    image,
    image_url: image,
    latitude: venue.latitude,
    longitude: venue.longitude,
    price_band: blankToNull(venue.price_band),
    // 0 means "unrated" here, not a one-star venue — drop it so the card hides
    // the rating instead of rendering an empty row of stars.
    google_rating: venue.google_rating || null,
    google_user_ratings_total: venue.google_user_ratings_total || null,
    google_maps_url: blankToNull(venue.google_maps_url),
    reservation_url: blankToNull(venue.reservation_url),
  };
}

function inferResponseMode(
  rawResponse: RawHandleMessageResponse,
  totalVenueCount: number
): GenieResponseMode {
  // Trust route.ts when it explicitly sets structured_results
  if (rawResponse.response_mode === "structured_results") {
    return "structured_results";
  }
  const xanoMode =
    rawResponse.reply_mode ??
    rawResponse.mode ??
    rawResponse.debug?.reply_mode;
  if (typeof xanoMode === "string") {
    switch (xanoMode) {
      case "has_results":
        return "structured_results";
      case "supported_no_results":
        return totalVenueCount > 0 ? "structured_results" : "supported_no_results";
      case "city_missing":
        return "city_missing";
      case "city_unsupported":
        return "city_unsupported";
      case "ai_fallback":
        return "ai_fallback";
    }
  }

  const debug = rawResponse.debug ?? {};
  const citySupported = debug.city_supported;

  if (citySupported === false) {
    return "city_unsupported";
  }

  if (rawResponse.use_xano) {
    return totalVenueCount > 0
      ? "structured_results"
      : "supported_no_results";
  }

  return "ai_fallback";
}

export function normalizeHandleMessageResponse(
  rawResponse: RawHandleMessageResponse,
  message: string
): GenieResponseEnvelope {
  const response = rawResponse.result ?? rawResponse;

  // ── Query mode ──────────────────────────────────────────────────────────
  const queryMode =
    typeof response.query_mode === "string"
      ? response.query_mode
      : "venue";

  // ── Events ───────────────────────────────────────────────────────────────
  const events = Array.isArray(response.events)
    ? response.events
    : [];

  // ── Venues ───────────────────────────────────────────────────────────────
  const allRawVenues = (
    response.venues ??
    response.decisive ??
    response.top_venues ??
    []
  ).map(mapVenue);

  const decisive = allRawVenues.slice(0, 3);
  const moreNearby = allRawVenues.slice(3, 15);

  const totalVenueCount = decisive.length + moreNearby.length;

  // ── Response mode ────────────────────────────────────────────────────────
  let responseMode = inferResponseMode(response, totalVenueCount);
  if (queryMode === "event" && events.length > 0) {
    responseMode = "structured_results";
  }

  const cityContext =
    typeof response.debug?.city === "string" &&
    response.debug.city.trim().length > 0
      ? response.debug.city
      : response.filters?.city ?? null;

  return {
    response_mode: responseMode,
    reply:
      response.reply?.trim() ||
      "Genie is warming up a few ideas for you.",
    normalized_intent: message.trim(),
    city_context: cityContext,
    use_xano: Boolean(response.use_xano),
    decisive,
    more_nearby: moreNearby,
    events,
    query_mode: queryMode,
    needs_location: Boolean(response.needs_location),
    session_id: response.session_id,
    session_token: response.session_token,
    show_intake_prompt: Boolean(response.show_intake_prompt),
    intake_prompt_copy:
      typeof response.intake_prompt_copy === "string"
        ? response.intake_prompt_copy
        : "",
    profile_strength_tier:
      typeof response.profile_strength_tier === "string"
        ? response.profile_strength_tier
        : undefined,
    filters: {
      city: response.filters?.city ?? cityContext,
      energy: response.filters?.energy ?? "",
      music: response.filters?.music ?? "",
      crowd: response.filters?.crowd ?? "",
      vibe_keywords: Array.isArray(response.filters?.vibe_keywords)
        ? response.filters.vibe_keywords
        : [],
    },
    debug: response.debug,
    raw: rawResponse,
  };
}