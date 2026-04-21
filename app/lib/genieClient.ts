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
};

export async function callGenie(
  message: string,
  options: CallGenieOptions = {}
): Promise<GenieResponseEnvelope> {
  const config = getRuntimeConfig();
  const token = readAuthToken();
  const account = readConsumerAccount();
  const { coords, radiusMeters } = options;
  const hasCoords = Boolean(
    coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
  );
  const body = {
    message,
    channel: "web",
    external_user_id: readExternalUserId() || (account?.id ? String(account.id) : "web_guest"),
    user_name: account?.firstName || undefined,
    session_token: readSessionToken(),
    // When we have real coords, let the backend determine the city from them.
    // Otherwise fall back to the runtime-configured city slug.
    city_context: hasCoords ? undefined : config.citySlug,
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
