import { mapVenue } from "./genieMappers";
import { type GenieVenue } from "./genieTypes";
import {
  clearConsumerSession,
  readAuthToken,
  writeAuthToken,
  writeConsumerAccount,
  writeSavedVenueIds,
  type ConsumerAccount,
  type ConsumerSubscriptionStatus,
} from "./localState";
import {
  readSessionToken,
  readSessionId,
  readExternalUserId,
  writeSessionToken,
  writeSessionId,
  writeExternalUserId,
  hasSession,
} from "./sessionToken";

export type PublicApiUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  membership: "free" | "vibee";
  subscription_status?: ConsumerSubscriptionStatus;
  vendor_id?: number | null;
};

type JsonInit = RequestInit & {
  auth?: boolean;
};

async function readErrorMessage(response: Response) {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

async function apiJson<T>(path: string, init: JsonInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  const token = init.auth !== false ? readAuthToken() : null;
  if (init.auth !== false) {
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && init.auth !== false && token) {
      clearStoredSession();
    }
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

export function toConsumerAccount(
  user: PublicApiUser,
  subscriptionStatus?: ConsumerSubscriptionStatus
): ConsumerAccount {
  const status = subscriptionStatus ?? user.subscription_status ?? "inactive";

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone ?? undefined,
    membership: status === "active" ? "vibee" : user.membership,
    subscriptionStatus: status,
    vendorId: user.vendor_id ?? null,
    createdAt: Date.now(),
  };
}

export function persistAuthSession(
  token: string,
  user: PublicApiUser,
  subscriptionStatus?: ConsumerSubscriptionStatus
) {
  writeAuthToken(token);
  const account = toConsumerAccount(user, subscriptionStatus);
  writeConsumerAccount(account);
  return account;
}

export function clearStoredSession() {
  clearConsumerSession();
}

/* ------------------------------------------------------------------ */
/*  Session Management                                                 */
/* ------------------------------------------------------------------ */

export async function initGuestSession() {
  if (hasSession()) {
    return {
      session_token: readSessionToken(),
      external_user_id: readExternalUserId(),
      session_id: readSessionId(),
    };
  }

  const result = await apiJson<{
    session_token: string;
    external_user_id: string;
    session_id: number;
  }>("/api/genie/session", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      channel: "web",
      context: { source: "web" },
    }),
  });

  writeSessionToken(result.session_token);
  writeExternalUserId(result.external_user_id);
  writeSessionId(result.session_id);
  return result;
}

export async function convertGuestSession(externalUserId: string) {
  const sessionToken = readSessionToken();
  if (!sessionToken) return null;

  return apiJson<{
    converted: boolean;
    session_id: number;
    user_id: number;
    venues_transferred: number;
  }>("/api/genie/session", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      action: "convert",
      session_token: sessionToken,
      external_user_id: externalUserId,
    }),
  });
}

/* ------------------------------------------------------------------ */
/*  Auth — Magic Link                                                  */
/* ------------------------------------------------------------------ */

export async function signUpUser(payload: {
  first_name?: string;
  last_name?: string;
  email: string;
}) {
  return apiJson<{ message: string; success?: boolean }>("/api/auth/signup", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export async function loginWithMagicToken(magicToken: string) {
  return apiJson<{
    token: string;
    user: PublicApiUser;
    external_user_id: string;
    is_new_user: boolean;
  }>("/api/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ magic_token: magicToken }),
  });
}

export async function fetchCurrentUser() {
  return apiJson<{ user: PublicApiUser }>("/api/auth/me");
}

/* ------------------------------------------------------------------ */
/*  Subscription                                                       */
/* ------------------------------------------------------------------ */

export async function fetchSubscriptionStatus() {
  return apiJson<{ status: ConsumerSubscriptionStatus }>(
    "/api/subscription/status"
  );
}

export async function fetchSubscriptionStatusForSession(sessionId: string) {
  const params = new URLSearchParams({ session_id: sessionId });
  return apiJson<{ status: ConsumerSubscriptionStatus }>(
    `/api/subscription/status?${params.toString()}`
  );
}

export async function createSubscriptionCheckout(payload: {
  email?: string;
  user_id?: number;
  external_user_id?: string;
  vendor_id?: number;
  plan_type?: string;
  boost_tier?: string;
  success_url?: string;
  cancel_url?: string;
}) {
  if (payload.vendor_id) {
    return apiJson<{ checkout_url: string }>("/api/subscription/create", {
      method: "POST",
      body: JSON.stringify({
        vendor_id: payload.vendor_id,
        plan_type: payload.plan_type,
        boost_tier: payload.boost_tier,
        email: payload.email,
        success_url: payload.success_url,
        cancel_url: payload.cancel_url,
      }),
    });
  }

  const externalUserId = readExternalUserId();
  return apiJson<{ checkout_url: string }>("/api/subscription/create", {
    method: "POST",
    body: JSON.stringify({
      external_user_id: payload.external_user_id || externalUserId || undefined,
      success_url: payload.success_url ?? "https://www.socialbevy.com/vibee/success",
      cancel_url: payload.cancel_url ?? "https://www.socialbevy.com/account",
    }),
  });
}

/* ------------------------------------------------------------------ */
/*  Saved Venues                                                       */
/* ------------------------------------------------------------------ */

export async function saveVenueForUser(
  venueId: number,
  sourceScreen = "decision",
  sourceQuery = ""
) {
  const sessionToken = readSessionToken();
  const sessionId = readSessionId();
  const externalUserId = readExternalUserId();
  const account = readAuthToken()
    ? (JSON.parse(
        localStorage.getItem("genie_consumer_account_v1") ?? "null"
      ) as ConsumerAccount | null)
    : null;

  return apiJson<{ success: boolean; saved?: boolean; already_saved?: boolean; prompt_signup?: boolean }>(
    "/api/user/save-venue",
    {
      method: "POST",
      auth: false,
      body: JSON.stringify({
        venue_id: venueId,
        user_id: account?.id ?? 0,
        session_id: sessionId || 0,
        external_user_id: externalUserId || undefined,
        session_token: sessionToken || undefined,
        source_screen: sourceScreen,
        source_query: sourceQuery,
      }),
    }
  );
}

export async function unsaveVenueForUser(venueId: number) {
  const sessionToken = readSessionToken();
  const sessionId = readSessionId();
  const externalUserId = readExternalUserId();
  const account = readAuthToken()
    ? (JSON.parse(
        localStorage.getItem("genie_consumer_account_v1") ?? "null"
      ) as ConsumerAccount | null)
    : null;

  return apiJson<{ success: boolean }>("/api/user/unsave-venue", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      venue_id: venueId,
      user_id: account?.id ?? 0,
      session_id: sessionId || 0,
      external_user_id: externalUserId || undefined,
      session_token: sessionToken || undefined,
    }),
  });
}

export async function fetchSavedVenues() {
  const externalUserId = readExternalUserId();
  const sessionToken = readSessionToken();
  const sessionId = readSessionId();
  const account = readAuthToken()
    ? (JSON.parse(
        localStorage.getItem("genie_consumer_account_v1") ?? "null"
      ) as ConsumerAccount | null)
    : null;

  if (!externalUserId && !account?.id && !sessionId) return [];

  const params = new URLSearchParams();
  if (externalUserId) params.set("external_user_id", externalUserId);
  if (account?.id) params.set("user_id", String(account.id));
  if (sessionId) params.set("session_id", String(sessionId));
  if (sessionToken) params.set("session_token", sessionToken);

  const response = await apiJson<{ venues: GenieVenue[]; count?: number }>(
    `/api/user/saved-venues?${params.toString()}`,
    { auth: false }
  );
  return (response.venues ?? []).map(mapVenue);
}

export async function registerPushToken(onesignalPlayerId: string) {
  const externalUserId = readExternalUserId();
  if (!externalUserId) {
    throw new Error("No external_user_id available for push registration.");
  }

  return apiJson<{
    success: boolean;
    message: string;
    user_id?: number;
    channel?: string;
  }>("/api/genie/register-push-token", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      external_user_id: externalUserId,
      onesignal_player_id: onesignalPlayerId,
      channel: "web",
    }),
  });
}

export async function sendNotification(payload: {
  user_id: number;
  notification_type: "vibe_check" | "whats_hot" | "personalized";
  title: string;
  message: string;
  url: string;
}) {
  return apiJson<{
    success: boolean;
    notification_type: string;
    status: number;
  }>("/api/genie/send-notification", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export async function markNotificationOpened(notificationId: number) {
  return apiJson<{
    success: boolean;
    notification_id: number;
  }>("/api/genie/notification-opened", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ notification_id: notificationId }),
  });
}

/* ------------------------------------------------------------------ */
/*  Vendor                                                             */
/* ------------------------------------------------------------------ */

export async function searchVendorBusinesses(query: string, city = "Houston") {
  const params = new URLSearchParams({ query, city });
  const response = await apiJson<{ results: GenieVenue[]; count?: number }>(
    `/api/vendor/search?${params.toString()}`,
    { auth: false }
  );
  return (response.results ?? []).map(mapVenue);
}

export async function vendorOnboardingSearch(payload: {
  business_name: string;
}) {
  return apiJson<{
    vendor_id: number;
    onboarding_id: number;
    current_step?: string;
    matches?: GenieVenue[];
  }>("/api/vendor/claim", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ step: "search", ...payload }),
  });
}

export async function vendorOnboardingContact(payload: {
  vendor_id: number;
  onboarding_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}) {
  return apiJson("/api/vendor/claim", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ step: "contact", ...payload }),
  });
}

export async function vendorOnboardingConfirm(payload: {
  vendor_id: number;
  onboarding_id: number;
  confirmed: boolean;
}) {
  return apiJson<{
    vendor_id: number;
    onboarding_id: number;
    current_step?: string;
  }>("/api/vendor/claim", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ step: "confirm", ...payload }),
  });
}

export async function createVendorBusiness(payload: {
  business_name: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  neighborhood?: string;
  category?: string;
  cuisine?: string;
  website?: string;
  reservation_url?: string;
  instagram?: string;
  short_description?: string;
  price_band?: string;
  music?: string;
  hookah?: string;
  happy_hour?: string;
  main_photo_url?: string;
  role_title?: string;
}) {
  return apiJson<{ success: boolean; vendor_id: number; onboarding_id?: number }>(
    "/api/vendor/create",
    {
      method: "POST",
      auth: false,
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchVendorDashboard(vendorId: number) {
  return apiJson<{
    vendor: {
      id: number;
      business_name: string;
      plan_selected: string;
      plan_tier: string;
      is_live: boolean;
      is_claimed: boolean;
    };
    venue: {
      venue_name: string;
      address: string;
      phone: string;
      website_url: string | null;
      reservation_url: string | null;
      reservation_platform: string | null;
      cuisine_tags: string[];
      google_maps_url: string;
      google_rating: number;
      area_neighborhood: string;
      image_primary_url?: string | null;
    };
    metrics: {
      genie_appearances: number;
      profile_views: number;
      call_clicks: number;
      map_clicks: number;
      reservation_clicks: number;
      saves: number;
      total_actions: number;
      engagement_rate: number;
    };
    trends: Array<{
      date: string;
      genie_appearances: number;
      profile_views: number;
      call_clicks: number;
      map_clicks: number;
      reservation_clicks: number;
      saves: number;
      total_actions: number;
    }>;
    profile_completeness: {
      score: number;
      missing_fields: string[];
    };
    first_appearance_at: number;
    last_appearance_at: number;
  }>(`/api/vendor/dashboard?vendor_id=${vendorId}`);
}

export async function fetchVendorAnalyticsSummary(
  vendorId: number,
  period = "30_days"
) {
  return apiJson<{
    period: string;
    totals: {
      genie_appearances: number;
      profile_views: number;
      call_clicks: number;
      map_clicks: number;
      reservation_clicks: number;
      saves: number;
      total_actions: number;
      engagement_rate: number;
    };
    daily_records: Array<Record<string, number | string>>;
  }>(
    `/api/vendor/dashboard?vendor_id=${vendorId}&view=analytics&period=${period}`
  );
}

export async function fetchVendorProfileCompleteness(vendorId: number) {
  return apiJson<{
    score: number;
    status: string;
    required_missing: string[];
    recommended_missing: string[];
    completed_fields: string[];
    total_fields_checked: number;
    fields_complete: number;
  }>(`/api/vendor/dashboard?vendor_id=${vendorId}&view=completeness`);
}

export async function updateVendorProfile(payload: Record<string, string>) {
  return apiJson<{ success: boolean }>("/api/vendor/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function logVendorInteraction(
  interactionType: string,
  venueId: number
) {
  const sessionId = readSessionId();
  const account = readAuthToken()
    ? (JSON.parse(
        localStorage.getItem("genie_consumer_account_v1") ?? "null"
      ) as ConsumerAccount | null)
    : null;

  fetch("/api/genie/interaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      venue_id: venueId,
      interaction_type: interactionType,
      user_id: account?.id ?? 0,
      session_id: sessionId,
    }),
    keepalive: true,
  }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Signup Prompt                                                      */
/* ------------------------------------------------------------------ */

export async function checkSignupPrompt() {
  const externalUserId = readExternalUserId();
  const sessionToken = readSessionToken();
  if (!externalUserId) return { should_show: false };

  const params = new URLSearchParams({
    external_user_id: externalUserId,
  });
  if (sessionToken) params.set("session_token", sessionToken);

  return apiJson<{
    should_show: boolean;
    prompt_type?: string;
    reason?: string;
  }>(`/api/genie/prompt?${params.toString()}`, {
    auth: false,
  });
}

export function logSignupPromptEvent(eventType: string, promptType = "signup_nudge") {
  const externalUserId = readExternalUserId();
  const sessionToken = readSessionToken();
  if (!externalUserId) return;

  fetch("/api/genie/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "log_event",
      external_user_id: externalUserId,
      session_token: sessionToken,
      event_type: eventType,
      prompt_type: promptType,
    }),
    keepalive: true,
  }).catch(() => {});
}

export function dismissSignupPrompt() {
  const externalUserId = readExternalUserId();
  const sessionToken = readSessionToken();
  if (!externalUserId) return;

  fetch("/api/genie/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "dismiss",
      external_user_id: externalUserId,
      session_token: sessionToken,
    }),
    keepalive: true,
  }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Analytics                                                          */
/* ------------------------------------------------------------------ */

export async function trackAnalyticsEvent(payload: {
  event: string;
  venue_id?: number | string;
  metadata?: Record<string, unknown>;
}) {
  const token = readAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const metadata = payload.metadata ?? {};
  const venueIdCandidate =
    payload.venue_id ?? metadata.venue_id ?? metadata.venueId;
  const parsedVenueId = Number(venueIdCandidate);
  const venueId = Number.isFinite(parsedVenueId) ? parsedVenueId : undefined;

  await fetch("/api/analytics/track", {
    method: "POST",
    headers,
    body: JSON.stringify({
      event: payload.event,
      venue_id: venueId,
      session_id: readSessionId(),
      metadata: {
        ...metadata,
        session_token: readSessionToken() || undefined,
        external_user_id: readExternalUserId() || undefined,
        session_id: readSessionId() || undefined,
      },
    }),
    keepalive: true,
  });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function syncSavedVenueIds(venues: GenieVenue[]) {
  const ids = venues.map((venue) => String(venue.id));
  writeSavedVenueIds(ids);
  return ids;
}

export function persistSessionState(payload: {
  token: string;
  user: PublicApiUser;
  subscriptionStatus?: ConsumerSubscriptionStatus;
  savedVenues?: GenieVenue[];
}) {
  const account = persistAuthSession(
    payload.token,
    payload.user,
    payload.subscriptionStatus
  );

  if (payload.savedVenues) {
    syncSavedVenueIds(payload.savedVenues);
  }

  return account;
}
