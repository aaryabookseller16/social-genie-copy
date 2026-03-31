import {
  analyticsEvents,
  type AnalyticsEventName,
} from "./analyticsEvents";
import { trackAnalyticsEvent } from "./publicApiClient";
import { readSessionToken } from "./sessionToken";

export type AnalyticsPayload = {
  event: AnalyticsEventName;
  timestamp: string;
  sessionId?: string;
  city?: string;
  data?: Record<string, unknown>;
};

function getSessionId() {
  return readSessionToken() || undefined;
}

async function sendToBackend(payload: AnalyticsPayload) {
  void trackAnalyticsEvent({
    event: payload.event,
    metadata: {
      timestamp: payload.timestamp,
      session_id: payload.sessionId,
      city: payload.city,
      ...(payload.data ?? {}),
    },
  }).catch(() => {});
}

export function trackEvent(
  event: AnalyticsEventName,
  data?: Record<string, unknown>
) {
  return sendToBackend({
    event,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    data,
  });
}

export function trackQuery(query: string) {
  return trackEvent(analyticsEvents.typedQuerySubmitted, { query });
}

export function trackTypedQueryStarted() {
  return trackEvent(analyticsEvents.typedQueryStarted);
}

export function trackHomeScreenViewed() {
  return trackEvent(analyticsEvents.homeScreenViewed);
}

export function trackQuickChipTapped(label: string, prompt: string) {
  return trackEvent(analyticsEvents.quickChipTapped, { label, prompt });
}

export function trackVoiceOrbTapped() {
  return trackEvent(analyticsEvents.voiceOrbTapped);
}

export function trackVenueClick(
  venueIdOrPayload: string | Record<string, unknown>,
  query?: string
) {
  const data =
    typeof venueIdOrPayload === "string"
      ? { venueId: venueIdOrPayload, query }
      : venueIdOrPayload;

  return trackEvent(analyticsEvents.decisionCardTapped, data);
}

export function trackVenueView(venueId: string) {
  return trackEvent(analyticsEvents.genieResultImpression, { venueId });
}

export function trackShare(venueId: string) {
  return trackEvent(analyticsEvents.venueShared, { venueId });
}

export function trackSave(venueId: string) {
  return trackEvent(analyticsEvents.venueSaved, { venueId });
}

export function trackWeeklySignup(contact: string) {
  return trackEvent(analyticsEvents.weeklySignup, { contact });
}
