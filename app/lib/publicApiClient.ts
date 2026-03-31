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
import { readSessionToken } from "./sessionToken";

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

function requireAuthToken() {
  const token = readAuthToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  return token;
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

export async function signUpUser(payload: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password: string;
  session_token?: string;
}) {
  return apiJson<{ token: string; user: PublicApiUser }>("/api/auth/signup", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: {
  email: string;
  password: string;
}) {
  return apiJson<{ token: string; user: PublicApiUser }>("/api/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export async function fetchCurrentUser() {
  requireAuthToken();
  return apiJson<{ user: PublicApiUser }>("/api/auth/me");
}

export async function fetchSubscriptionStatus() {
  requireAuthToken();
  return apiJson<{ status: ConsumerSubscriptionStatus }>(
    "/api/subscription/status"
  );
}

export async function createSubscriptionCheckout() {
  requireAuthToken();
  return apiJson<{ checkout_url: string }>("/api/subscription/create", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function saveVenueForUser(venueId: number) {
  requireAuthToken();
  return apiJson<{ success: boolean }>("/api/user/save-venue", {
    method: "POST",
    body: JSON.stringify({ venue_id: venueId }),
  });
}

export async function unsaveVenueForUser(venueId: number) {
  requireAuthToken();
  return apiJson<{ success: boolean }>("/api/user/unsave-venue", {
    method: "POST",
    body: JSON.stringify({ venue_id: venueId }),
  });
}

export async function fetchSavedVenues() {
  requireAuthToken();
  const response = await apiJson<{ venues: GenieVenue[] }>("/api/user/saved-venues");
  return response.venues.map(mapVenue);
}

export async function searchVendorBusinesses(query: string) {
  requireAuthToken();
  const params = new URLSearchParams({ query });
  const response = await apiJson<{ results: GenieVenue[] }>(
    `/api/vendor/search?${params.toString()}`
  );
  return response.results.map(mapVenue);
}

export async function claimVendorBusiness(payload: {
  venue_id: number;
  contact_name: string;
  email: string;
  phone?: string;
  selected_plan_id?: string;
  location_enabled?: boolean;
}) {
  requireAuthToken();
  return apiJson<{ success: boolean; claim_status: string }>("/api/vendor/claim", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createVendorBusiness(payload: {
  business_name: string;
  full_name: string;
  email: string;
  phone?: string;
  address: string;
  city_state_zip?: string;
  is_manual_entry?: boolean;
  selected_plan_id?: string;
  location_enabled?: boolean;
}) {
  requireAuthToken();
  return apiJson<{ success: boolean; vendor_id: number }>("/api/vendor/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchVendorDashboard() {
  requireAuthToken();
  return apiJson<{
    views: number;
    clicks: number;
    saves: number;
    genie_appearances: number;
  }>("/api/vendor/dashboard");
}

export async function updateVendorProfile(payload: {
  description?: string;
  phone?: string;
  website_url?: string;
  reservation_url?: string;
  hours?: string;
  image_primary_url?: string;
}) {
  requireAuthToken();
  return apiJson<{ success: boolean }>("/api/vendor/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

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

export async function trackAnalyticsEvent(payload: {
  event: string;
  venue_id?: number;
  metadata?: Record<string, unknown>;
}) {
  const token = readAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  await fetch("/api/analytics/track", {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...payload,
      metadata: {
        ...(payload.metadata ?? {}),
        session_token: readSessionToken() || undefined,
      },
    }),
    keepalive: true,
  });
}
