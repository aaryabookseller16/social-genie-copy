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
  getOrCreateDeviceId,
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

export type SocialProfile = {
  profile_id?: number;
  device_id?: string;
  external_user_id?: string | null;
  experiences_tags?: string[];
  atmosphere_tags?: string[];
  bevy_bites_tags?: string[];
  community_tags?: string[];
  music_tags?: string[];
  price_range?: string;
  group_size?: string;
  typical_time?: string;
  intake_completed?: boolean;
  intake_shown_count?: number;
  signal_count?: number;
  last_updated_at?: number;
};

export type SocialSignalType =
  | "query"
  | "venue_tap"
  | "venue_save"
  | "offer_view"
  | "offer_redeem"
  | "more_nearby_tap";

export type VibeeOffer = {
  id: number;
  title: string;
  offer_type: string;
  description?: string;
  discount_value?: string;
  redeem_instructions?: string;
  vendor_id: number;
  active?: boolean;
  redemption_count?: number;
  redemption_limit?: number;
  vibee_only?: boolean;
  // Optional venue context — populated by Xano when available,
  // used for offer cards and venue detail linking.
  venue_name?: string;
  venue_image?: string;
  venue_neighborhood?: string;
  venue_rating?: number;
  venue_review_count?: number;
  expires_at?: number | null;
};

export type VibeeRedemption = {
  id: number;
  offer_id: number;
  vendor_id: number;
  redemption_token: string;
  redeemed_at: number;
  verified_by_staff?: boolean;
  verified_at?: number | null;
  // Optional denormalised context from the backend.
  offer_title?: string;
  offer_type?: string;
  venue_name?: string;
  expires_at?: number | null;
};

export type VerifyRedemptionResult = {
  valid: boolean;
  offer_title: string;
  redeemed_at: number;
  verified_at: number;
  member_name: string;
  vendor_id: number;
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

export async function updateUserProfile(payload: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}) {
  return apiJson<{ user: PublicApiUser }>("/api/auth/update-profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Update VENDOR contact info (V-05 flow).
 * Requires the user to have a `genie_vendor` row linked — otherwise Xano
 * returns "Vendor profile not found". For consumer users use
 * `updateUserProfile` instead.
 */
export async function saveVendorContactInfo(payload: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}) {
  const external_user_id = readExternalUserId();
  if (!external_user_id) {
    throw new Error("You must be signed in to update vendor contact info.");
  }
  return apiJson<{
    success: boolean;
    vendor: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string | null;
    };
  }>("/api/vendor/contact-info", {
    method: "POST",
    body: JSON.stringify({ ...payload, external_user_id }),
  });
}

export async function deleteAccount() {
  const external_user_id = readExternalUserId();
  if (!external_user_id) {
    throw new Error("You must be signed in to delete your account.");
  }
  return apiJson<{ success: boolean; message?: string }>(
    "/api/auth/delete-account",
    {
      method: "POST",
      body: JSON.stringify({ external_user_id }),
    }
  );
}

export async function fetchVendorProfile() {
  const external_user_id = readExternalUserId();
  if (!external_user_id) {
    throw new Error("You must be signed in to view your vendor profile.");
  }
  const params = new URLSearchParams({ external_user_id });
  return apiJson<{
    error: string | null;
    vendor: {
      id: number;
      user_id: number;
      venue_id: number;
      business_name: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      business_address: string;
      city: string;
      state: string;
      zip: string;
      latitude: number;
      longitude: number;
      is_live: boolean;
      is_claimed: boolean;
      location_enabled: boolean;
      plan_selected: string;
      plan_selected_at: number;
      stripe_customer_id: string;
      onboarding_completed: boolean;
      monthly_boost_active: boolean;
      reservation_url: string;
      reservation_platform: string;
    } | null;
  }>(`/api/vendor/profile?${params.toString()}`);
}

export async function saveVendorProfileChanges(payload: {
  business_name?: string;
  business_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  location_enabled?: boolean;
  reservation_url?: string;
  reservation_platform?: string;
}) {
  const external_user_id = readExternalUserId();
  if (!external_user_id) {
    throw new Error("You must be signed in to update your vendor profile.");
  }
  return apiJson<{ error: string | null; success: boolean }>(
    "/api/vendor/profile",
    {
      method: "PUT",
      body: JSON.stringify({ ...payload, external_user_id }),
    }
  );
}

export async function submitContactForm(payload: {
  first_name?: string;
  last_name?: string;
  email: string;
  subject?: string;
  description: string;
}) {
  // Auth header is attached automatically if the user is signed in;
  // anonymous submissions are still accepted by the API route.
  return apiJson<{ success: boolean; message?: string }>("/api/contact", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
  // Server route handles default success_url / cancel_url — client only forwards
  // overrides when the caller provides them explicitly.
  if (payload.vendor_id) {
    return apiJson<{
      checkout_url: string;
      session_id?: string;
      plan_type?: string;
      mode?: string;
    }>("/api/subscription/create", {
      method: "POST",
      body: JSON.stringify({
        vendor_id: payload.vendor_id,
        plan_type: payload.plan_type,
        boost_tier: payload.boost_tier,
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
      success_url: payload.success_url,
      cancel_url: payload.cancel_url,
    }),
  });
}

/* ------------------------------------------------------------------ */
/*  Social Learning + V.I.Bee Offers                                   */
/* ------------------------------------------------------------------ */

export async function initDeviceProfile(payload: {
  external_user_id?: string;
  session_id?: string;
}) {
  return apiJson<SocialProfile & { is_new?: boolean }>("/api/genie/init-device", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      device_id: getOrCreateDeviceId(),
      external_user_id: payload.external_user_id,
      session_id: payload.session_id,
    }),
  });
}

export async function mergeGuestProfile(externalUserId: string) {
  return apiJson<{ success?: boolean; signals_merged?: number }>(
    "/api/genie/merge-guest-profile",
    {
      method: "POST",
      auth: false,
      body: JSON.stringify({
        device_id: getOrCreateDeviceId(),
        external_user_id: externalUserId,
      }),
    }
  );
}

export async function trackSocialSignal(payload: {
  signal_type: SocialSignalType;
  signal_value: string;
  category_tags?: string[];
  city?: string;
  neighborhood?: string;
}) {
  const externalUserId = readExternalUserId();
  const sessionId = readSessionId();

  return apiJson("/api/genie/track-signal", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      device_id: getOrCreateDeviceId(),
      external_user_id: externalUserId || undefined,
      session_id: sessionId ? String(sessionId) : undefined,
      signal_type: payload.signal_type,
      signal_value: payload.signal_value,
      category_tags: payload.category_tags ?? undefined,
      city: payload.city ?? undefined,
      neighborhood: payload.neighborhood ?? undefined,
    }),
  });
}

export async function fetchSocialProfile() {
  const externalUserId = readExternalUserId();
  const params = new URLSearchParams();

  if (externalUserId) {
    params.set("external_user_id", externalUserId);
  } else {
    params.set("device_id", getOrCreateDeviceId());
  }

  return apiJson<SocialProfile>(`/api/genie/social-profile?${params.toString()}`, {
    auth: false,
  });
}

export async function updateSocialProfile(payload: Partial<SocialProfile>) {
  const externalUserId = readExternalUserId();
  return apiJson<SocialProfile & { success?: boolean }>(
    "/api/genie/social-profile",
    {
      method: "POST",
      auth: false,
      body: JSON.stringify({
        device_id: getOrCreateDeviceId(),
        external_user_id: externalUserId || undefined,
        ...payload,
      }),
    }
  );
}

export async function fetchVibeeOffers() {
  const externalUserId = readExternalUserId();
  if (!externalUserId) {
    throw new Error("Sign in required to view V.I.Bee offers.");
  }

  const params = new URLSearchParams({ external_user_id: externalUserId });
  return apiJson<{ offers: VibeeOffer[]; offer_count: number }>(
    `/api/genie/offers?${params.toString()}`,
    { auth: false }
  );
}

export async function redeemVibeeOffer(offerId: number) {
  const externalUserId = readExternalUserId();
  if (!externalUserId) {
    throw new Error("Sign in required to redeem offers.");
  }

  return apiJson<{
    success: boolean;
    redemption_token: string;
    offer_title: string;
    redeemed_at: number;
    verify_url: string;
  }>("/api/genie/redeem-offer", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      external_user_id: externalUserId,
      offer_id: offerId,
    }),
  });
}

export async function fetchUserRedemptions() {
  const externalUserId = readExternalUserId();
  if (!externalUserId) {
    throw new Error("Sign in required to view redemptions.");
  }

  const params = new URLSearchParams({ external_user_id: externalUserId });
  return apiJson<{ redemptions: VibeeRedemption[]; redemption_count: number }>(
    `/api/genie/redemptions?${params.toString()}`,
    { auth: false }
  );
}

export async function verifyRedemptionToken(token: string) {
  return apiJson<VerifyRedemptionResult>(
    `/api/genie/verify-redemption/${encodeURIComponent(token)}`,
    { auth: false }
  );
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
    vendor_id: number;
    business_name: string;
    email: string;
    plan_selected: string;
    is_live: boolean;
    plan_selected_at: number;
    onboarding_completed: boolean;
    is_pro: boolean;
    offers: Array<{
      id: number;
      title: string;
      offer_type: string;
      member_only?: boolean;
      active?: boolean;
      redeem_instructions?: string | null;
      schedule_json?: Record<string, unknown> | null;
    }>;
    offer_count: number;
  }>(`/api/vendor/dashboard?vendor_id=${vendorId}`);
}

export async function createVendorOffer(payload: {
  vendor_id: number;
  title: string;
  description: string;
  offer_type:
    | "happy_hour"
    | "brunch"
    | "perk"
    | "weekly_special"
    | "drink_special"
    | "food_special"
    | "event_access"
    | "vip_only"
    | "limited_time"
    | "experience"
    | "group_offer"
    | "late_night"
    | "other";
  discount_value?: string;
  redeem_instructions?: string;
  link_url?: string;
  redemption_limit?: number;
  vibee_only?: boolean;
}) {
  return apiJson<{ success: boolean; offer_id: number }>("/api/vendor/offer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateVendorProfile(payload: Record<string, unknown>) {
  const external_user_id = readExternalUserId();
  if (!external_user_id) {
    throw new Error("You must be signed in to update your vendor profile.");
  }
  // Xano `ep_save_profile_changes_dev` resolves the vendor via
  // `external_user_id`. Supported fields: business_name, business_address,
  // city, state, zip, location_enabled, reservation_url, reservation_platform.
  // Other keys passed in `payload` are dropped by the route handler.
  return apiJson<{ success: boolean; error?: string | null }>(
    "/api/vendor/profile",
    {
      method: "PUT",
      body: JSON.stringify({ ...payload, external_user_id }),
    }
  );
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

/* ------------------------------------------------------------------ */
/*  Vendor Analytics & Profile Completeness                            */
/* ------------------------------------------------------------------ */

export async function fetchVendorAnalytics(
  vendorId: number,
  period: "7_days" | "30_days" | "all_time" = "30_days"
) {
  const params = new URLSearchParams({
    vendor_id: String(vendorId),
    period,
  });
  return apiJson<{
    period: string;
    totals: Record<string, number>;
    daily_records: Array<Record<string, unknown>>;
  }>(`/api/vendor/analytics?${params.toString()}`);
}

export async function fetchVendorProfileCompleteness(vendorId: number) {
  const params = new URLSearchParams({ vendor_id: String(vendorId) });
  return apiJson<{
    score: number;
    status: "strong" | "good" | "needs_work";
    required_missing: string[];
    recommended_missing: string[];
    completed_fields: string[];
  }>(`/api/vendor/profile-completeness?${params.toString()}`);
}

/* ------------------------------------------------------------------ */
/*  Stripe Products & Sessions                                         */
/* ------------------------------------------------------------------ */

export async function fetchStripeProducts() {
  return apiJson<unknown>("/api/stripe/products");
}

export async function createStripeSession(
  payload: Record<string, unknown>
) {
  return apiJson<{ checkout_url?: string; session_id?: string }>(
    "/api/stripe/sessions",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchStripeSession(sessionId: string) {
  return apiJson<Record<string, unknown>>(
    `/api/stripe/sessions/${encodeURIComponent(sessionId)}`
  );
}

export async function fetchStripeSessionLineItems(sessionId: string) {
  return apiJson<Record<string, unknown>>(
    `/api/stripe/sessions/${encodeURIComponent(sessionId)}/line_items`
  );
}
