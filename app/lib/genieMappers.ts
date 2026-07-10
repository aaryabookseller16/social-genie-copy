import {
  type GenieResponseEnvelope,
  type GenieResponseMode,
  type GenieVenue,
  type RawGenieVenue,
  type RawHandleMessageResponse,
} from "./genieTypes";
import { toImageList } from "./image";

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

function inferResponseMode(
  rawResponse: RawHandleMessageResponse,
  totalVenueCount: number
): GenieResponseMode {
  const xanoMode =
    rawResponse.reply_mode ??
    rawResponse.mode ??
    rawResponse.debug?.reply_mode;
  if (typeof xanoMode === "string") {
    switch (xanoMode) {
      case "has_results":
        return "structured_results";
      case "supported_no_results":
        return "supported_no_results";
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

  // If the backend flags the city as unsupported, always fall back to text —
  // even if `use_xano` is true or stray venues come back from a geo match.
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
  // Backend returns query_mode: "event" | "venue"
  const queryMode =
    typeof response.query_mode === "string"
      ? response.query_mode
      : "venue";

  // ── Events ───────────────────────────────────────────────────────────────
  // Only populated when query_mode === "event"
  const events = Array.isArray(response.events)
    ? response.events
    : [];

  // ── Venues ───────────────────────────────────────────────────────────────
  // Backend can return venues under several key names depending on the path
  const rawVenues =
    response.venues ??
    response.decisive ??
    response.top_venues ??
    [];

  const rawMoreNearby =
    response.more_nearby_venues ??
    response.more_nearby ??
    response.more_venues ??
    [];

  const decisive = rawVenues
    .map(mapVenue)
    .slice(0, 3);

  const moreNearby = rawMoreNearby
    .map(mapVenue)
    .slice(0, 12);

  const totalVenueCount = decisive.length + moreNearby.length;

  // ── Response mode ────────────────────────────────────────────────────────
  // If we got events back treat it as structured results so the
  // frontend decision screen renders event cards
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
