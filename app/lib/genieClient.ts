import { normalizeHandleMessageResponse } from "./genieMappers";
import {
  type GenieFilters,
  type GenieResponseEnvelope,
  type GenieVenue,
  type RawHandleMessageResponse,
} from "./genieTypes";
import { readAuthToken, readConsumerAccount } from "./localState";
import { getRuntimeConfig } from "./runtimeConfig";
import {
  readSessionToken,
  readExternalUserId,
  writeSessionToken,
  writeSessionId,
} from "./sessionToken";

export type { GenieFilters, GenieResponseEnvelope, GenieVenue };

export type CallGenieOptions = {
  coords?: { lat: number; lng: number } | null;
  radiusMeters?: number;
  cityContext?: string | null;
  // When false, coords are dropped from the request even if provided — used
  // when an explicit city in the message takes priority over device location.
  includeCoords?: boolean;
};

export async function callGenie(
  message: string,
  options: CallGenieOptions = {}
): Promise<GenieResponseEnvelope> {
  const config = getRuntimeConfig();
  const token = readAuthToken();
  const account = readConsumerAccount();
  const { coords, radiusMeters, cityContext, includeCoords = true } = options;
  const hasCoords =
    includeCoords &&
    Boolean(coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng));
  const body = {
    message,
    channel: "web",
    external_user_id: readExternalUserId() || (account?.id ? String(account.id) : "web_guest"),
    user_name: account?.firstName || undefined,
    session_token: readSessionToken(),
    city_context:
      typeof cityContext === "string" && cityContext.trim().length > 0
        ? cityContext.trim()
        : undefined,
    lat: hasCoords ? coords!.lat : undefined,
    lng: hasCoords ? coords!.lng : undefined,
    radius_meters:
      typeof radiusMeters === "number" && Number.isFinite(radiusMeters)
        ? radiusMeters
        : 2500,
    user: account?.id
      ? {
          first_name: account.firstName,
          user_id: String(account.id),
        }
      : undefined,
    user_data: account
      ? {
          first_name: account.firstName,
          membership: account.membership,
        }
      : {},
    meta: {
      source: "home",
    },
    debug: false,
  };

  const res = await fetch("/api/genie/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errorText = "";

    try {
      errorText = JSON.stringify(await res.json());
    } catch {
      errorText = await res.text();
    }

    console.error("Genie API error", res.status, errorText);

    return {
      response_mode: "ai_fallback",
      reply:
        "I hit a glitch in my brain talking to the server. Try that request again in a bit.",
      normalized_intent: message.trim(),
      city_context: config.cityLabel,
      use_xano: false,
      decisive: [],
      more_nearby: [],
      events: [],
  query_mode: "venue",
      needs_location: false,
      show_intake_prompt: false,
      intake_prompt_copy: "",
      filters: {
        city: config.cityLabel,
        energy: "",
        music: "",
        crowd: "",
        vibe_keywords: [],
      },
      raw: { error: errorText },
    };
  }

  const data = (await res.json()) as RawHandleMessageResponse;
  const normalized = normalizeHandleMessageResponse(data, message);

  writeSessionToken(normalized.session_token);
  if (typeof normalized.session_id === "number" && Number.isFinite(normalized.session_id)) {
    writeSessionId(normalized.session_id);
  }

  return normalized;
}
