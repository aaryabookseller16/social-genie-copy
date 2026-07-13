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
  display_name?: string | null;
  avatar_url?: string | null;
  membership: "free" | "vibee";
  subscription_status?: ConsumerSubscriptionStatus;
  vendor_id?: number | null;
  verified?: boolean;
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

function findErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return typeof payload === "string" ? payload : null;
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["error", "message", "Message", "detail"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  for (const value of Object.values(record)) {
    const nested = findErrorMessage(value);
    if (nested) {
      return nested;
    }
  }

  return null;
}

async function readErrorMessage(response: Response) {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const payload = await response.json();
    return findErrorMessage(payload) || fallback;
  } catch {
    return fallback;
  }
}

export async function apiJson<T>(path: string, init: JsonInit = {}) {
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
    displayName: user.display_name ?? undefined,
    avatarUrl: user.avatar_url ?? undefined,
    membership: status === "active" ? "vibee" : user.membership,
    subscriptionStatus: status,
    vendorId: user.vendor_id ?? null,
    verified: user.verified ?? false,
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

/**
 * `email` is intentionally absent — it is the identity the magic-link login
 * resolves against, so it cannot be changed without a re-verification flow.
 */
export async function updateUserProfile(payload: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  display_name?: string;
  avatar_url?: string;
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
  first_name: string;
  last_name: string;
  email: string;
  topic: string;
  message: string;
  source?: "app" | "website" | string;
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
      email: payload.email || undefined,
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

  const result = await apiJson<{
    success?: boolean;
    message?: string;
    error?: string;
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

  if (result.success === false) {
    throw new Error(result.message || result.error || "Could not redeem this offer right now.");
  }

  return result;
}

/**
 * Redeem an influencer offer via the influencer-specific endpoint so the
 * influencer's commission is credited. Requires a logged-in genie_user JWT
 * (auto-attached by apiJson). Input is only the promo_code.
 */
export async function redeemInfluencerOffer(promoCode: string) {
  if (!readAuthToken()) {
    throw new Error("Sign in required to redeem offers.");
  }

  const result = await apiJson<{
    success?: boolean;
    error?: string;
    redemption_id?: number;
    offer_title?: string;
    offer_type?: string;
    discount_value?: number | string;
    discount_type?: string;
    influencer_name?: string;
    message?: string;
  }>("/api/genie/redeem-influencer-offer", {
    method: "POST",
    body: JSON.stringify({ promo_code: promoCode }),
  });

  if (result.success === false) {
    throw new Error(result.error || "Could not redeem this offer.");
  }

  return result;
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

export async function fetchVenueById(venueId: string | number) {
  const response = await apiJson<{ venue: GenieVenue }>(
    `/api/genie/venue?id=${encodeURIComponent(String(venueId))}`,
    { auth: false }
  );
  return mapVenue(response.venue);
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

export type PublicEventSearchResult = {
  id: number;
  title: string;
  event_date?: string;
  venue_name?: string | null;
  city?: string;
};

export async function searchPublicEvents(query: string) {
  const params = new URLSearchParams({ query });
  const response = await apiJson<{
    results: PublicEventSearchResult[];
    count?: number;
  }>(`/api/events/search?${params.toString()}`, { auth: false });
  return response.results ?? [];
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
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchMyVendorProfile() {
  return apiJson<{ vendor: { id: number; business_name?: string; is_live?: boolean; onboarding_completed?: boolean } | null }>(
    `/api/vendor/profile`
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
    // Venue/profile fields surfaced for the Edit Profile form
    description?: string | null;
    vibe_notes?: string | null;
    phone?: string | null;
    website?: string | null;
    website_url?: string | null;
    reservation_url?: string | null;
    hours_text?: string | null;
    image_primary_url?: string | null;
    address?: string | null;
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

export type VendorRecord = {
  id?: number;
  user_id?: number;
  venue_id?: number;
  business_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  business_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  is_claimed?: boolean;
  is_live?: boolean;
  location_enabled?: boolean;
  plan_selected?: string;
  onboarding_completed?: boolean;
  monthly_boost_active?: boolean;
  reservation_url?: string;
  reservation_platform?: string;
  stripe_customer_id?: string;
};

export type VenueRecord = {
  id?: number;
  venue_name?: string;
  address?: string;
  city?: string;
  phone?: string;
  website_url?: string;
  reservation_url?: string;
  reservation_platform?: string;
  instagram_handle?: string;
  facebook_url?: string;
  google_maps_url?: string;
  image_primary_url?: string;
  image_fallback_url?: string;
  vibe_notes?: string;
  hours_text?: string;
  hours_json?: Record<string, unknown>;
  venue_type?: string;
  cuisine_tags?: unknown;
  dietary_tags?: unknown;
  price_band?: string;
  price_level?: number;
  google_rating?: number;
  google_user_ratings_total?: number;
  neighborhood_text?: string;
  area_neighborhood?: string;
  reservations_supported?: boolean;
  is_open_now?: boolean;
  is_vendor_subscriber?: boolean;
  priority_tier?: string;
};

export type VendorVenueDetails = {
  error: string | null;
  vendor: VendorRecord | null;
  venue: VenueRecord | null;
};

export type VenueImage = {
  id: number;
  venue_id: number;
  image_url: string;
  image_type?: "primary" | "fallback" | "gallery";
  sort_order?: number;
  source?: string;
  is_active?: boolean;
};

type VenueImagesResponse = {
  success: boolean;
  venue_id: number;
  images: VenueImage[];
};

/** Ordered venue photos for the signed-in vendor. Index 0 is the primary. */
export async function fetchVenueImages() {
  const { images } = await apiJson<VenueImagesResponse>("/api/vendor/venue-images");
  return images.map((image) => image.image_url);
}

/** Replaces the whole gallery. Pass [] to remove every photo. */
export async function saveVenueImages(images: string[]) {
  return apiJson<VenueImagesResponse>("/api/vendor/venue-images", {
    method: "POST",
    body: JSON.stringify({ images }),
  });
}

export async function fetchVendorVenue() {
  const external_user_id = readExternalUserId();
  if (!external_user_id) {
    throw new Error("You must be signed in to view your venue details.");
  }
  const params = new URLSearchParams({ external_user_id });
  return apiJson<VendorVenueDetails>(
    `/api/vendor/venue?${params.toString()}`
  );
}

export async function updateVendorVenue(payload: {
  venue_name?: string;
  description?: string;
  phone?: string;
  website_url?: string;
  reservation_url?: string;
  reservation_platform?: string;
  hours_text?: string;
  is_open_now?: boolean;
  image_primary_url?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}) {
  const external_user_id = readExternalUserId();
  if (!external_user_id) {
    throw new Error("You must be signed in to update your venue details.");
  }
  return apiJson<{ success: boolean; error?: string | null }>(
    "/api/vendor/venue",
    {
      method: "PUT",
      body: JSON.stringify({ ...payload, external_user_id }),
    }
  );
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
/*  Venue Interaction Logging                                          */
/*  Feeds genie_user_venue_interaction + genie_behavior_signals       */
/*  for behavioral aggregation and personalization.                   */
/*  Fire-and-forget — never blocks UI.                                */
/* ------------------------------------------------------------------ */
export function logVenueInteraction(
  interactionType: string,
  venueId: number,
  sourceScreen?: string
) {
  const sessionId = readSessionId();
  const account = readAuthToken()
    ? (JSON.parse(
        localStorage.getItem("genie_consumer_account_v1") ?? "null"
      ) as ConsumerAccount | null)
    : null;
  fetch("/api/genie/log-venue-interaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      venue_id: venueId,
      interaction_type: interactionType,
      user_id: account?.id ?? 0,
      session_id: sessionId,
      source_screen: sourceScreen ?? "",
    }),
    keepalive: true,
  }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Event Interaction Logging                                          */
/*  Feeds genie_user_event_interaction + genie_behavior_signals       */
/*  for behavioral aggregation and personalization.                   */
/*  Fire-and-forget — never blocks UI.                                */
/* ------------------------------------------------------------------ */
export function logEventInteraction(
  interactionType: string,
  eventId: number,
  sourceScreen?: string
) {
  const sessionId = readSessionId();
  const account = readAuthToken()
    ? (JSON.parse(
        localStorage.getItem("genie_consumer_account_v1") ?? "null"
      ) as ConsumerAccount | null)
    : null;
  fetch("/api/genie/log-event-interaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_id: eventId,
      interaction_type: interactionType,
      user_id: account?.id ?? 0,
      session_id: sessionId,
      source_screen: sourceScreen ?? "",
    }),
    keepalive: true,
  }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Signup Prompt                                                      */
/* ------------------------------------------------------------------ */

export async function saveProducerDetails(payload: {
  brand_name?: string;
  producer_handle?: string;
}) {
  const externalUserId = readExternalUserId();
  if (!externalUserId) throw new Error("No session found.");
  return apiJson<{ success: boolean; brand_name: string; producer_handle: string }>(
    "/api/genie/save-producer-details",
    {
      method: "POST",
      auth: false,
      body: JSON.stringify({ external_user_id: externalUserId, ...payload }),
    }
  );
}

export async function saveInfluencerDetails(payload: {
  influencer_handle?: string;
}) {
  const externalUserId = readExternalUserId();
  if (!externalUserId) throw new Error("No session found.");
  return apiJson<{ success: boolean; influencer_handle: string }>(
    "/api/genie/save-influencer-details",
    {
      method: "POST",
      auth: false,
      body: JSON.stringify({ external_user_id: externalUserId, ...payload }),
    }
  );
}

export async function setUserRoles(roles: string[]) {
  const externalUserId = readExternalUserId();
  if (!externalUserId) {
    throw new Error("No session found — cannot save roles.");
  }
  return apiJson<{ success: boolean; roles: string[] }>(
    "/api/genie/set-user-roles",
    {
      method: "POST",
      auth: false,
      body: JSON.stringify({ external_user_id: externalUserId, roles }),
    }
  );
}

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
/*  Vendor Offers (list / toggle / delete)                            */
/* ------------------------------------------------------------------ */

export type VendorOfferItem = {
  id: number;
  title: string;
  description?: string;
  offer_type: string;
  active?: boolean;
  vibee_only?: boolean;
  redeem_instructions?: string | null;
  discount_value?: string | null;
};

export async function fetchVendorOffers(vendorId: number) {
  const params = new URLSearchParams({ vendor_id: String(vendorId) });
  return apiJson<VendorOfferItem[]>(`/api/vendor/offers?${params.toString()}`);
}

export async function toggleVendorOffer(offerId: number, active: boolean) {
  return apiJson<{ success: boolean }>("/api/vendor/offers", {
    method: "PATCH",
    body: JSON.stringify({ offer_id: offerId, active }),
  });
}

export async function deleteVendorOffer(offerId: number) {
  return apiJson<{ success: boolean }>(
    `/api/vendor/offers?offer_id=${offerId}`,
    { method: "DELETE" }
  );
}

/* ------------------------------------------------------------------ */
/*  Vendor — Influencer Offer Review Queue                            */
/* ------------------------------------------------------------------ */

/**
 * All influencer offers (active / pending / rejected) for the venues the
 * calling owner has claimed. Owned venues are resolved server-side from the
 * caller's JWT. Pass `status` to filter server-side, or omit for all.
 */
export async function fetchVendorInfluencerOffers(
  status?: "active" | "pending" | "rejected"
) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiJson<{
    success?: boolean;
    offers?: InfluencerOffer[];
    count?: number;
  }>(`/api/vendor/influencer-offers${qs}`);
}

/**
 * Approve or reject a pending influencer offer. Only the venue owner may
 * review. `rejection_reason` is stored when rejecting.
 */
export async function reviewInfluencerOffer(payload: {
  offer_id: number;
  decision: "approve" | "reject" | "cancel";
  rejection_reason?: string;
}) {
  return apiJson<{
    success?: boolean;
    offer_id?: number;
    status?: string;
    reviewed_at?: string | number;
  }>("/api/vendor/review-offer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ------------------------------------------------------------------ */
/*  Vendor Influencer Codes                                            */
/* ------------------------------------------------------------------ */

export type VendorInfluencerCode = {
  code: string;
  redeemed: number;
  new_users: number;
  vibee_conversions: number;
  history?: string[];
};

export async function fetchVendorInfluencerCodes(vendorId: number) {
  const params = new URLSearchParams({ vendor_id: String(vendorId) });
  return apiJson<{ codes: VendorInfluencerCode[] }>(
    `/api/vendor/influencer-codes?${params.toString()}`
  );
}

/* ------------------------------------------------------------------ */
/*  Vendor Notification Preferences                                    */
/* ------------------------------------------------------------------ */

export type VendorNotifPrefs = {
  external_user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  sms_phone?: string;
};

export async function fetchVendorNotifPrefs(externalUserId: string) {
  const params = new URLSearchParams({ external_user_id: externalUserId });
  return apiJson<Partial<VendorNotifPrefs>>(
    `/api/vendor/notifications?${params.toString()}`
  );
}

export async function updateVendorNotifPrefs(prefs: VendorNotifPrefs) {
  return apiJson<{ success: boolean }>("/api/vendor/notifications", {
    method: "POST",
    body: JSON.stringify(prefs),
  });
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

/* ------------------------------------------------------------------ */
/*  Influencer                                                         */
/* ------------------------------------------------------------------ */

export interface MyInfluencerProfile {
  id?: number;
  user_id?: number;
  handle?: string;
  display_name?: string;
  bio?: string;
  profile_image_url?: string | null;
  instagram_handle?: string;
  tiktok_handle?: string;
  youtube_handle?: string;
  content_niche?: string;
  content_categories?: Record<string, unknown>;
  primary_platform?: string;
  total_followers?: number;
  tier?: string;
  plan_tier?: string;
  is_verified?: boolean;
  verified_at?: number;
  total_redemptions?: number;
  total_earnings?: number;
  total_venues_partnered?: number;
  referral_count?: number;
  vibes_score?: number;
}

export interface InfluencerOffer {
  id: number;
  offer_type: string;
  offer_title: string;
  offer_description?: string;
  promo_code?: string;
  unique_code?: string;
  discount_value?: number | string;
  discount_type?: string;
  max_redemptions?: number;
  redemption_count?: number;
  redemptions_used?: number;
  status: string;
  expires_at?: string | number;
  // Exactly one of these is set. Venue-based offers carry `venue_id` (event_id
  // absent/null); event-based offers carry `event_id` (the API reports
  // `venue_id: 0` on those rows rather than omitting it, so don't rely on
  // `venue_id` being falsy to mean "no venue" — check `event_id` instead).
  venue_id?: number;
  event_id?: number;
  event_title?: string;
  event_date?: string;
  total_clicks?: number;
  rejection_reason?: string;
  reviewed_at?: string | number;
}

export interface InfluencerDashboardData {
  active_codes_count?: number;
  total_redemptions?: number;
  total_commission_earned?: number;
  referral_signups?: number;
  pending_commission?: number;
  paid_commission?: number;
  offers?: InfluencerOffer[];
  landing_url?: string;
  referral_url?: string;
}

export async function fetchMyInfluencerProfile() {
  return apiJson<MyInfluencerProfile>("/api/genie/influencer-profile");
}

export async function createInfluencerProfile(payload: {
  display_name: string;
  bio?: string;
  instagram_handle?: string;
  tiktok_handle?: string;
  content_niche?: string;
}) {
  return apiJson<MyInfluencerProfile>("/api/genie/create-influencer-profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchInfluencerDashboard() {
  return apiJson<InfluencerDashboardData>("/api/genie/influencer-dashboard");
}

export async function fetchInfluencerOffers(handle: string) {
  const params = new URLSearchParams({ handle });
  return apiJson<{ offers?: InfluencerOffer[]; success?: boolean }>(
    `/api/genie/influencer-offers?${params.toString()}`,
    { auth: false }
  );
}

export interface CreatedInfluencerOffer {
  success?: boolean;
  offer_id?: number;
  status?: string;
  promo_code?: string;
  offer_type?: string;
  offer_title?: string;
  landing_url?: string;
}

/**
 * Influencer creates an offer tied to either a venue or an event. Offer
 * starts in `pending` status until the venue owner (vendor) or event owner
 * (producer) approves it. Provide exactly one of `venue_id` / `event_id`.
 */
export async function createInfluencerOffer(payload: {
  venue_id?: number;
  event_id?: number;
  offer_title: string;
  offer_type: string;
  offer_description?: string;
  discount_value?: number;
  promo_code?: string;
  max_redemptions?: number;
  expires_at?: string;
}) {
  return apiJson<CreatedInfluencerOffer>("/api/genie/create-influencer-offer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type InfluencerOfferAnalytics = InfluencerOffer & {
  total_redemptions?: number;
  new_user_count?: number;
  vibbee_conversions?: number;
};

/**
 * Per-offer aggregate analytics for the calling influencer (all statuses).
 * Returns aggregate counts only — there is no per-redemption list.
 */
export async function fetchInfluencerOfferAnalytics() {
  return apiJson<{
    influencer_id?: number;
    offers?: InfluencerOfferAnalytics[];
  }>("/api/genie/influencer-offer-analytics");
}

/* ------------------------------------------------------------------ */
/*  Producer                                                           */
/* ------------------------------------------------------------------ */

export type ProducerProfile = {
  id?: number;
  user_id?: number;
  display_name?: string;
  bio?: string;
  instagram_handle?: string;
  instagram_url?: string;
  tiktok_url?: string;
  website_url?: string;
  event_type_tags?: string[];
  profile_photo_url?: string;
  city?: string;
  status?: string;
  is_verified?: boolean;
  follower_count?: number;
  total_events_created?: number;
  total_events_live?: number;
  average_going_count?: number;
};

export type ProducerEvent = {
  id: number;
  title: string;
  category?: string;
  description?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  venue_name?: string;
  venue_address?: string;
  city?: string;
  cover_image_url?: string;
  /** Ordered gallery; index 0 is the cover. Legacy rows may return `{}` from Xano. */
  image_urls?: string[];
  ticket_url?: string;
  ticket_price_min?: number;
  is_free?: boolean;
  age_requirement?: string;
  rsvp_limit?: number;
  rsvp_count?: number;
  going_count?: number;
  created_at?: number;
};

export type ProducerPost = {
  id: number;
  author_id?: number;
  author_type?: string;
  post_text: string;
  image_url?: string;
  /** Ordered gallery; index 0 is the primary. Legacy rows may return `{}` from Xano. */
  image_urls?: string[];
  like_count?: number;
  comment_count?: number;
  created_at?: number;
};

export type ProducerEventAnalytics = {
  event_id: number;
  rsvp_count?: number;
  view_count?: number;
  save_count?: number;
  [key: string]: unknown;
};

export type ProducerAudienceAnalytics = {
  producer_id?: number;
  follower_count?: number;
  total_events?: number;
  total_going?: number;
  total_views?: number;
  cities?: Array<{ city: string; count: number }>;
  [key: string]: unknown;
};

export type ProducerRsvpEntry = {
  id: number;
  user_id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  rsvped_at?: number;
  [key: string]: unknown;
};

/**
 * Gate check: look up the current user's producer profile via JWT.
 * Returns { profile: ProducerProfile } if found (any status), { profile: null } if not.
 * Uses /api/producer/profile → ep_get_my_producer_profile_dev.
 */
export async function fetchMyProducerProfile() {
  return apiJson<{ profile: ProducerProfile | null }>(`/api/producer/profile`);
}

export async function fetchMyEvents(page = 1, perPage = 20) {
  return apiJson<{ success: boolean; events: ProducerEvent[]; total: number }>(
    `/api/producer/events?page=${page}&per_page=${perPage}`
  );
}

export async function fetchMyPosts(page = 1, perPage = 20) {
  return apiJson<{ success: boolean; posts: ProducerPost[]; total: number }>(
    `/api/producer/post?page=${page}&per_page=${perPage}`
  );
}

export async function setupProducerProfile(payload: {
  display_name: string;
  bio?: string;
  instagram_handle?: string;
  event_type_tags?: string[];
}) {
  return apiJson<ProducerProfile>("/api/producer/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createProducerEvent(payload: {
  title: string;
  category: string;
  producer_id?: number;
  description?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  venue_id?: number;
  venue_name?: string;
  venue_address?: string;
  city?: string;
  cover_image_url?: string;
  image_urls?: string[];
  ticket_url?: string;
  ticket_price_min?: number;
  is_free?: boolean;
  age_requirement?: string;
  rsvp_limit?: number;
  event_id?: number;
}) {
  return apiJson<ProducerEvent>("/api/producer/event", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchProducerEventAnalytics(eventId: number) {
  return apiJson<ProducerEventAnalytics>(
    `/api/producer/event-analytics?event_id=${eventId}`
  );
}

export async function fetchProducerAudienceAnalytics() {
  return apiJson<ProducerAudienceAnalytics>("/api/producer/audience-analytics");
}

export async function fetchProducerRsvpList(eventId: number) {
  return apiJson<ProducerRsvpEntry[] | { rsvps?: ProducerRsvpEntry[] }>(
    `/api/producer/rsvp-list?event_id=${eventId}`
  );
}

export async function createProducerPost(payload: {
  post_text: string;
  image_url?: string;
  image_urls?: string[];
}) {
  return apiJson<ProducerPost>("/api/producer/post", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type ProducerNotifPrefs = {
  notify_new_follower?: boolean;
  notify_post_like?: boolean;
  notify_post_comment?: boolean;
  notify_going_match?: boolean;
  notify_venue_energy_alert?: boolean;
  notify_event_reminder?: boolean;
  notify_promoter_new_event?: boolean;
  notify_new_message?: boolean;
  notify_genie_alerts?: boolean;
};

export async function fetchProducerNotifPrefs() {
  return apiJson<ProducerNotifPrefs>("/api/producer/notifications");
}

export async function updateProducerNotifPrefs(prefs: ProducerNotifPrefs) {
  return apiJson<{ success: boolean }>("/api/producer/notifications", {
    method: "POST",
    body: JSON.stringify(prefs),
  });
}

export type FollowProducerResult = {
  success: boolean;
  action: "followed" | "unfollowed";
  followed_id: number;
  followed_type: string;
};

export async function followProducer(
  producerId: number,
  source: string = "profile"
) {
  return apiJson<FollowProducerResult>("/api/producer/follow", {
    method: "POST",
    body: JSON.stringify({
      followed_id: producerId,
      followed_type: "producer",
      follow_source: source,
    }),
  });
}

/* ------------------------------------------------------------------ */
/*  Producer — Influencer Offer Review Queue                          */
/* ------------------------------------------------------------------ */

/**
 * All influencer offers (any status, or filtered) for events the calling
 * producer owns. Owned events are resolved server-side from the caller's JWT.
 */
export async function fetchProducerInfluencerOffers(
  status?: "active" | "pending" | "rejected" | "cancelled"
) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiJson<{
    success?: boolean;
    offers?: InfluencerOffer[];
    count?: number;
  }>(`/api/producer/influencer-offers${qs}`);
}

/**
 * Approve or reject a pending influencer offer targeting one of the caller's
 * events. Same underlying review endpoint as the vendor flow — ownership is
 * resolved server-side depending on whether the offer targets a venue or event.
 */
export async function reviewProducerOffer(payload: {
  offer_id: number;
  decision: "approve" | "reject" | "cancel";
  rejection_reason?: string;
}) {
  return apiJson<{
    success?: boolean;
    offer_id?: number;
    status?: string;
    reviewed_at?: string | number;
  }>("/api/producer/review-offer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ------------------------------------------------------------------ */
/*  Producer public profile page                                       */
/* ------------------------------------------------------------------ */

export type ProducerPublicPageData = {
  success: boolean;
  producer: ProducerProfile;
  is_following: boolean;
  upcoming_events: ProducerEvent[];
  event_count: number;
};

export async function fetchProducerPublicProfile(producerId: number) {
  return apiJson<ProducerPublicPageData>(
    `/api/producer/profile-public?producer_id=${producerId}`
  );
}

export type UserBasicProfile = {
  success: boolean;
  user_id: number;
  display_name: string;
  avatar_url: string;
};

/** Minimal public lookup for a plain genie_user (name + avatar only) — used
 * to resolve a real customer name in the producer's message inbox instead
 * of the generic "Customer" placeholder. */
export async function fetchUserBasicProfile(userId: number) {
  return apiJson<UserBasicProfile>(`/api/user/basic-profile?user_id=${userId}`);
}

/* ------------------------------------------------------------------ */
/*  Notifications                                                       */
/* ------------------------------------------------------------------ */

export type UserNotification = {
  id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: number;
  target_url?: string;
  actor_name?: string;
  actor_image_url?: string;
};

/** Raw notification row as returned by Xano (genie/get-notifications-dev). */
type RawNotification = {
  id: number;
  notification_type?: string;
  title?: string;
  body?: string;
  is_read?: boolean;
  created_at?: string | number;
  data_json?: Record<string, unknown> | null;
};

function normalizeNotification(row: RawNotification): UserNotification {
  const data = (row.data_json ?? {}) as Record<string, unknown>;
  // The UI's timeAgo() expects Unix *seconds*. Xano returns created_at as a Unix
  // millisecond number (e.g. 1782859974610); tolerate an ISO string too.
  let createdAt = 0;
  if (typeof row.created_at === "number") {
    // Values >= 1e11 are milliseconds; smaller ones are already seconds.
    createdAt =
      row.created_at >= 1e11
        ? Math.floor(row.created_at / 1000)
        : row.created_at;
  } else if (typeof row.created_at === "string") {
    const parsed = Date.parse(row.created_at);
    createdAt = Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
  }
  const pickString = (key: string) =>
    typeof data[key] === "string" ? (data[key] as string) : undefined;

  return {
    id: row.id,
    type: row.notification_type ?? "notification",
    title: row.title ?? "",
    body: row.body ?? "",
    is_read: Boolean(row.is_read),
    created_at: createdAt,
    target_url: pickString("target_url"),
    actor_name: pickString("actor_name"),
    actor_image_url: pickString("actor_image_url"),
  };
}

export async function fetchUserNotifications() {
  const raw = await apiJson<{ notifications?: RawNotification[] }>(
    "/api/user/notifications"
  );
  return {
    notifications: (raw.notifications ?? []).map(normalizeNotification),
  };
}

export async function fetchUnreadNotifCount() {
  return apiJson<{ unread_count: number }>(
    "/api/user/notifications/unread-count"
  );
}

/** Mark one or many notifications as read (single tap → pass [id]). */
export async function markNotificationsRead(notificationIds: number[]) {
  return apiJson<{ success: boolean }>("/api/user/notifications", {
    method: "PATCH",
    body: JSON.stringify({ notification_ids: notificationIds }),
  });
}

/* ------------------------------------------------------------------ */
/*  Messaging                                                           */
/* ------------------------------------------------------------------ */

export type MessageThreadType = "producer" | "user";

/** Max characters allowed in a single message (mirrored by the composer's maxLength). */
export const MAX_MESSAGE_LENGTH = 2000;

function assertMessageLength(text: string) {
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
  }
}

type RawProducerThread = {
  id: number;
  user_id: number;
  producer_id: number;
  producer_display_name?: string;
  producer_profile_photo_url?: string;
  user_unread_count?: number;
  producer_unread_count?: number;
  last_message_at?: number | string;
  last_message_preview?: string;
  status?: "request" | "active" | "archived";
  thread_origin?: string;
};

type RawUserThread = {
  id: number;
  participant_one_id: number;
  participant_two_id: number;
  participant_one_unread?: number;
  participant_two_unread?: number;
  last_message_preview?: string;
  last_message_at?: number | string;
  status?: string;
};

export type Conversation = {
  threadId: number;
  threadType: MessageThreadType;
  counterpartId: number;
  counterpartName?: string;
  counterpartAvatarUrl?: string;
  lastMessagePreview?: string;
  lastMessageAt: number;
  unreadCount: number;
  status?: string;
  /**
   * For threadType "producer" only: whether the current viewer IS the
   * producer (business owner reading their inbox) or the consumer who
   * messaged that producer. genie_message_threads is asymmetric — the
   * producer replies via a different endpoint (ep_producer_reply_dev) and
   * the counterpart is the other party, not always producer_id.
   */
  viewerRole?: "consumer" | "producer";
};

export type RawMessage = {
  id: number;
  thread_id: number;
  sender_id: number;
  recipient_id: number;
  recipient_type: MessageThreadType;
  message_text: string;
  is_read: boolean;
  created_at: string | number;
};

function toEpochMs(value: number | string | undefined): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Raw threads fetch — caller must merge producer_threads + user_threads (different shapes). */
export async function fetchMessageThreads(
  threadType: "all" | MessageThreadType = "all",
  page = 1,
  perPage = 20
) {
  return apiJson<{
    success?: boolean;
    producer_threads?: RawProducerThread[];
    user_threads?: RawUserThread[];
  }>(
    `/api/messages/threads?page=${page}&per_page=${perPage}&thread_type=${threadType}`
  );
}

/** Normalizes + merges both thread shapes into one sorted-by-recency list for the unified inbox UI. */
export function mergeThreadsToConversations(
  raw: { producer_threads?: RawProducerThread[]; user_threads?: RawUserThread[] },
  currentUserId?: number
): Conversation[] {
  const fromProducer: Conversation[] = (raw.producer_threads ?? []).map((t) => {
    // If the viewer isn't the thread's consumer (user_id), they must be the
    // producer owner looking at their business inbox — the counterpart is
    // then the consumer, not the producer (themselves).
    const viewerIsProducerOwner = currentUserId !== undefined && t.user_id !== currentUserId;
    return {
      threadId: t.id,
      threadType: "producer" as const,
      counterpartId: viewerIsProducerOwner ? t.user_id : t.producer_id,
      counterpartName: viewerIsProducerOwner ? undefined : t.producer_display_name,
      counterpartAvatarUrl: viewerIsProducerOwner ? undefined : t.producer_profile_photo_url,
      lastMessagePreview: t.last_message_preview,
      lastMessageAt: toEpochMs(t.last_message_at),
      unreadCount: (viewerIsProducerOwner ? t.producer_unread_count : t.user_unread_count) ?? 0,
      status: t.status,
      viewerRole: viewerIsProducerOwner ? ("producer" as const) : ("consumer" as const),
    };
  });

  const fromUser: Conversation[] = (raw.user_threads ?? []).map((t) => {
    const isP1 = t.participant_one_id === currentUserId;
    return {
      threadId: t.id,
      threadType: "user" as const,
      counterpartId: isP1 ? t.participant_two_id : t.participant_one_id,
      lastMessagePreview: t.last_message_preview,
      lastMessageAt: toEpochMs(t.last_message_at),
      unreadCount: (isP1 ? t.participant_one_unread : t.participant_two_unread) ?? 0,
      status: t.status,
    };
  });

  return [...fromProducer, ...fromUser].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

/** No dedicated unread-count endpoint exists; derive it from the inbox fetch. */
export async function fetchUnreadMessageCount(currentUserId?: number) {
  const raw = await fetchMessageThreads("all", 1, 100);
  const conversations = mergeThreadsToConversations(raw, currentUserId);
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

/** Generic dispatcher so future entry points (vendor/consumer profiles) are a one-line wire-up. */
export async function sendMessage(input: {
  recipientId: number;
  recipientType: MessageThreadType;
  text: string;
}) {
  if (input.recipientType === "producer") {
    return sendMessageToProducer(input.recipientId, input.text);
  }
  return sendMessageToUser(input.recipientId, input.text);
}

export async function sendMessageToProducer(producerId: number, text: string) {
  assertMessageLength(text);
  return apiJson<{ success: boolean; message: RawMessage; thread_id: number; is_new_thread?: boolean }>(
    "/api/messages/producer",
    {
      method: "POST",
      body: JSON.stringify({ recipient_id: producerId, recipient_type: "producer", message_text: text }),
    }
  );
}

export async function sendMessageToUser(recipientUserId: number, text: string) {
  assertMessageLength(text);
  return apiJson<{ success: boolean; message: RawMessage; thread_id: number; is_new_thread: boolean }>(
    "/api/messages/user",
    {
      method: "POST",
      body: JSON.stringify({ recipient_id: recipientUserId, message_text: text }),
    }
  );
}

/** The producer-owner side of a business thread replies here — a different
 * endpoint than sendMessageToProducer, since the producer isn't "messaging
 * a producer" (themselves), they're replying within an existing thread. */
export async function replyAsProducer(threadId: number, text: string) {
  assertMessageLength(text);
  return apiJson<{ success: boolean; message: RawMessage; thread_id: number }>(
    "/api/messages/producer-reply",
    {
      method: "POST",
      body: JSON.stringify({ thread_id: threadId, message_text: text }),
    }
  );
}

/** Zeroes the caller's own unread counter for a thread (fire-and-forget from the UI). */
export async function markThreadRead(threadType: MessageThreadType, threadId: number) {
  return apiJson<{ success: boolean }>("/api/messages/mark-read", {
    method: "POST",
    body: JSON.stringify({ thread_id: threadId, thread_type: threadType }),
  });
}

export async function fetchThreadMessages(
  threadType: MessageThreadType,
  threadId: number,
  page = 1,
  perPage = 30
) {
  const path = threadType === "producer" ? "/api/messages/producer-thread" : "/api/messages/user-thread";
  return apiJson<{
    success?: boolean;
    thread?: Record<string, unknown>;
    total?: number;
    page?: number;
    per_page?: number;
    messages?: RawMessage[];
  }>(`${path}?thread_id=${threadId}&page=${page}&per_page=${perPage}`);
}

export async function blockUser(userId: number) {
  return apiJson<{ success: boolean }>("/api/messages/block", {
    method: "POST",
    body: JSON.stringify({ blocked_user_id: userId }),
  });
}

export async function unblockUser(userId: number) {
  return apiJson<{ success: boolean }>("/api/messages/unblock", {
    method: "POST",
    body: JSON.stringify({ blocked_user_id: userId }),
  });
}

export async function fetchBlockedUsers() {
  return apiJson<{ success?: boolean; blocked_user_ids?: number[]; count?: number }>(
    "/api/messages/blocked"
  );
}

export async function reportUserProfile(payload: {
  userId: number;
  reason: "spam" | "inappropriate" | "false_info" | "harassment" | "hate_speech" | "other";
  details?: string;
}) {
  return apiJson<{ success: boolean }>("/api/messages/report", {
    method: "POST",
    body: JSON.stringify({
      content_type: "profile",
      content_id: payload.userId,
      report_reason: payload.reason,
      report_details: payload.details,
    }),
  });
}

/* ------------------------------------------------------------------ */
/*  Homescreen Feed                                                     */
/* ------------------------------------------------------------------ */

export type UpcomingEvent = {
  id: number;
  title: string;
  producer_id?: number;
  producer?: {
    id?: number;
    name?: string;
    display_name?: string;
    image_url?: string;
    profile_photo_url?: string;
    event_count?: number;
    total_events_live?: number;
    is_verified?: boolean;
    is_following?: boolean;
  };
  cover_image_url?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  venue_name?: string;
  venue_address?: string;
  neighborhood?: string;
  city?: string;
  description?: string;
  category?: string;
  event_category?: string;
  going_count?: number;
  rsvp_count?: number;
  is_free?: boolean;
  is_sold_out?: boolean;
  ticket_url?: string;
  ticket_price_min?: number;
  ticket_price_max?: number;
  age_requirement?: number;
  public_slug?: string;
  status?: string;
  is_on_fire?: boolean;
  [key: string]: unknown;
};

export type TrendingVenue = {
  id: number | string;
  venue_name: string;
  image_primary_url?: string;
  image_fallback_url?: string;
  cover_image_url?: string;
  image_url?: string;
  neighborhood?: string;
  area_neighborhood?: string;
  neighborhood_text?: string;
  energy_level?: string;
  going_count?: number;
  is_on_fire?: boolean;
  address?: string;
  [key: string]: unknown;
};

export type HomescreenApiResponse = {
  success: boolean;
  city_id: number;
  city_name: string;
  weather?: Record<string, unknown>;
  trending_venues?: TrendingVenue[];
  upcoming_events?: UpcomingEvent[];
  active_placements?: Record<string, unknown>[];
  top_neighborhoods?: Record<string, unknown>[];
  generated_at?: string;
};

export type HomescreenStory = {
  id: number;
  name: string;
  image_url: string;
};

export type HomescreenFeatured = {
  id: number;
  type: "event" | "venue";
  title: string;
  image_url: string;
};

export type EventFeedItem = {
  feed_type: "event";
  id: number;
  title: string;
  venue_name?: string;
  start_time?: string;
  event_date?: string;
  cover_image_url?: string;
  going_count?: number;
  people_you_know?: number;
  is_on_fire?: boolean;
  badge?: string;
  producer_id?: number;
  producer?: {
    name: string;
    image_url?: string;
    event_count?: number;
    producer_id?: number;
    handle?: string;
    is_verified?: boolean;
    is_following?: boolean;
  };
  reason?: string;
  raw: UpcomingEvent;
};

export type SocialEnergyAlertItem = {
  feed_type: "social_energy_alert";
  id: number;
  message: string;
};

export type SocialPostItem = {
  feed_type: "social_post";
  id: number;
  author_name: string;
  author_image_url?: string;
  time_ago: string;
  body: string;
  image_url?: string;
  comment_count?: number;
  notification_count?: number;
};

export type OnFireVenueItem = {
  feed_type: "on_fire_venue";
  id: number;
  venue_name: string;
  venue_address?: string;
  neighborhood?: string;
  category?: string;
  description?: string;
  going_count?: number;
  badge?: string;
};

export type SuggestedProducerItem = {
  feed_type: "suggested_producer";
  id: number;
  name: string;
  image_url?: string;
  event_count?: number;
  producer_id?: number;
  handle?: string;
};

export type FeedItem =
  | EventFeedItem
  | SocialEnergyAlertItem
  | SocialPostItem
  | OnFireVenueItem
  | SuggestedProducerItem;

export type HomescreenData = {
  stories: HomescreenStory[];
  featured: HomescreenFeatured[];
  feed: FeedItem[];
  raw?: HomescreenApiResponse;
};

export async function fetchHomescreen(options: {
  cityId?: number;
  cityName?: string;
  userId?: number;
  lat?: number;
  lng?: number;
  page?: number;
} = {}): Promise<HomescreenApiResponse> {
  const { cityId = 1, cityName = "Houston", userId, lat, lng, page = 1 } = options;
  const params = new URLSearchParams();
  params.set("city_id", String(cityId));
  params.set("city_name", cityName);
  params.set("page", String(page));
  if (userId) params.set("user_id", String(userId));
  if (lat != null) params.set("lat", String(lat));
  if (lng != null) params.set("lng", String(lng));
  return apiJson<HomescreenApiResponse>(
    `/api/genie/homescreen?${params.toString()}`,
    { auth: false }
  );
}

/* ------------------------------------------------------------------ */
/*  Event Detail                                                        */
/* ------------------------------------------------------------------ */

export type EventDetailProducer = {
  id?: number;
  name?: string;
  image_url?: string;
  event_count?: number;
  is_verified?: boolean;
  is_following?: boolean;
};

export type EventDetailMiniEvent = {
  id: number;
  title?: string;
  cover_image_url?: string;
  category?: string;
  event_date?: string;
  [key: string]: unknown;
};

// Mirrors the actual (nested) shape /api/genie/event-detail returns from Xano's
// ep_get_event_detail_dev — { success, event, venue, related_events, related_count }.
// Per-event fields (title, going_count, user_rsvp_status, ...) live under `event`,
// not at the top level; this used to be declared flat, which is how the
// user_rsvp_status/going_count merge bug in EventDetailSection went unnoticed.
export type EventDetailResponse = {
  success?: boolean;
  event: {
    id: number;
    title: string;
    cover_image_url?: string;
    event_date?: string;
    start_time?: string;
    end_time?: string;
    venue_name?: string;
    venue_address?: string;
    description?: string;
    category?: string;
    ticket_url?: string;
    is_free?: boolean;
    ticket_price_min?: number;
    public_slug?: string;
    going_count?: number;
    interested_count?: number;
    user_rsvp_status?: "going" | "interested" | "saved" | null;
    is_on_fire?: boolean;
    producer?: EventDetailProducer;
    offer_type?: string;
    offer_title?: string;
    offer_description?: string;
    [key: string]: unknown;
  };
  venue?: Record<string, unknown> | null;
  related_events?: EventDetailMiniEvent[];
  related_count?: number;
  [key: string]: unknown;
};

export async function fetchEventDetail(eventId: number): Promise<EventDetailResponse> {
  return apiJson<EventDetailResponse>(
    `/api/genie/event-detail?event_id=${eventId}`
  );
}

/* ------------------------------------------------------------------ */
/*  Event RSVP (Going / Interested)                                    */
/* ------------------------------------------------------------------ */

export type RsvpStatus = "going" | "interested" | "saved" | "removed";

export type RsvpEventResult = {
  success: boolean;
  message: string;
  rsvp: unknown;
};

export async function rsvpToEvent(
  eventId: number,
  status: RsvpStatus,
  source = "event-detail"
) {
  return apiJson<RsvpEventResult>("/api/genie/rsvp-event", {
    method: "POST",
    body: JSON.stringify({ event_id: eventId, status, source }),
  });
}

/* ------------------------------------------------------------------ */
/*  Venue Check-in                                                      */
/* ------------------------------------------------------------------ */

export type CheckinResult = {
  success: boolean;
  checkin?: { id: number; venue_id: number; checked_in_at: string; expires_at: number } | null;
  already_checked_in?: boolean;
  social_energy_score?: number;
  social_energy_state?: string;
};

export type CheckoutResult = {
  success: boolean;
  checked_out: boolean;
  venue_id: number;
};

export type VenueCheckinsResult = {
  success: boolean;
  venue_id: number;
  active_checkins: number;
  user_is_checked_in: boolean;
};

export async function checkInToVenue(venueId: number) {
  return apiJson<CheckinResult>("/api/genie/checkin", {
    method: "POST",
    body: JSON.stringify({ venue_id: venueId }),
  });
}

export async function checkOutOfVenue(venueId: number) {
  return apiJson<CheckoutResult>("/api/genie/checkout", {
    method: "POST",
    body: JSON.stringify({ venue_id: venueId }),
  });
}

export async function fetchVenueCheckins(venueId: number) {
  // The route handler resolves "is this user checked in" from the caller's
  // own auth token server-side — no user id needs to (or should) be sent
  // from here.
  return apiJson<VenueCheckinsResult>(
    `/api/genie/venue-checkins?venue_id=${venueId}`
  );
}
