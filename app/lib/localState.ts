export type ConsumerMembership = "guest" | "free" | "vibee";
export type ConsumerSubscriptionStatus =
  | "active"
  | "inactive"
  | "cancelled"
  | "past_due";

export type ConsumerAccount = {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  membership: ConsumerMembership;
  subscriptionStatus?: ConsumerSubscriptionStatus;
  vendorId?: number | null;
  createdAt: number;
};

const SAVED_VENUES_STORAGE_KEY = "genie_saved_venues_v1";
const CONSUMER_ACCOUNT_STORAGE_KEY = "genie_consumer_account_v1";
const AUTH_TOKEN_STORAGE_KEY = "genie_auth_token_v1";

export function readSavedVenueIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_VENUES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function writeSavedVenueIds(ids: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SAVED_VENUES_STORAGE_KEY,
    JSON.stringify(Array.from(new Set(ids.map(String))))
  );
}

export function toggleSavedVenueId(id: string) {
  const next = new Set(readSavedVenueIds());

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  const value = Array.from(next);
  writeSavedVenueIds(value);
  return value;
}

export function clearSavedVenueIds() {
  writeSavedVenueIds([]);
}

export function readConsumerAccount(): ConsumerAccount | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CONSUMER_ACCOUNT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConsumerAccount) : null;
  } catch {
    return null;
  }
}

export function writeConsumerAccount(account: ConsumerAccount | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!account) {
    window.localStorage.removeItem(CONSUMER_ACCOUNT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    CONSUMER_ACCOUNT_STORAGE_KEY,
    JSON.stringify(account)
  );
}

export function readAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  return value?.trim() ? value : null;
}

export function writeAuthToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!token) {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearConsumerSession() {
  writeAuthToken(null);
  writeConsumerAccount(null);
  clearSavedVenueIds();
}
