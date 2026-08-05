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
  displayName?: string;
  avatarUrl?: string;
  membership: ConsumerMembership;
  subscriptionStatus?: ConsumerSubscriptionStatus;
  vendorId?: number | null;
  verified?: boolean;
  createdAt: number;
  // Roles unlocked server-side (genie_user.roles), refreshed on every
  // hydrate. Source of truth — see readSelectedRoles() for the pre-login
  // onboarding-only local cache this supersedes once signed in.
  roles?: OnboardingRole[];
};

// Additive onboarding roles. "consumer" (Discover & Go Out) is always implied.
export type OnboardingRole = "consumer" | "vendor" | "producer" | "influencer";

// Drives the magic-link verification gate: a user who completed the onboarding
// wizard but has not yet clicked their magic link has no auth token, so we
// remember the pending email and block gated actions until verified.
export type OnboardingPendingState = {
  email: string;
  completedAt: number;
  verified: boolean;
};

const SAVED_VENUES_STORAGE_KEY = "genie_saved_venues_v1";
const CONSUMER_ACCOUNT_STORAGE_KEY = "genie_consumer_account_v1";
// Matches ACCESS_COOKIE in app/lib/server/authCookies.ts — kept in sync
// manually since that file is server-only (imports next/server) and can't be
// imported from client code.
const ACCESS_TOKEN_COOKIE = "genie_access_token";
const ONBOARDING_ROLES_STORAGE_KEY = "genie_onboarding_roles_v1";
const ACTIVE_ROLE_STORAGE_KEY = "genie_active_role_v1";
const ONBOARDING_PENDING_STORAGE_KEY = "genie_onboarding_pending_v1";
const REFERRAL_CODE_STORAGE_KEY = "genie_referral_code_v1";

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

/**
 * Reads the access token cookie set by app/api/auth/login and
 * app/api/auth/refresh. The refresh token is httpOnly and never touches JS —
 * this is only ever the short-lived (24h) access token, kept JS-readable
 * specifically so realtimeMessaging.ts can hand it to the Xano realtime SDK.
 */
export function readAuthToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
  if (!match) return null;

  const value = decodeURIComponent(match.slice(ACCESS_TOKEN_COOKIE.length + 1));
  return value.trim() ? value : null;
}

/**
 * Normally the server sets this cookie via Set-Cookie (see
 * app/lib/server/authCookies.ts) — this client-side setter only exists as a
 * defensive clear (token: null) for callers that want to drop local auth
 * state without waiting on a round trip to /api/auth/logout.
 */
export function writeAuthToken(token: string | null) {
  if (typeof document === "undefined") {
    return;
  }

  if (!token) {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
  }
}

// Captured on /join?ref=CODE, consumed once by the signup form so the new
// account gets attributed to whoever's link they came from.
export function readReferralCode(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(REFERRAL_CODE_STORAGE_KEY);
  return value?.trim() ? value : null;
}

export function writeReferralCode(code: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!code) {
    window.localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, code);
}

export function readSelectedRoles(): OnboardingRole[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ONBOARDING_ROLES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as OnboardingRole[]) : [];
  } catch {
    return [];
  }
}

export function writeSelectedRoles(roles: OnboardingRole[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    ONBOARDING_ROLES_STORAGE_KEY,
    JSON.stringify(Array.from(new Set(roles)))
  );
}

// The role the user last switched into, used to label the homescreen top bar.
// Unlike readSelectedRoles (which roles are *unlocked*), this is the one role
// the user is currently acting as. Defaults to "consumer".
export function readActiveRole(): OnboardingRole {
  if (typeof window === "undefined") {
    return "consumer";
  }

  const raw = window.localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);
  return raw === "vendor" || raw === "producer" || raw === "influencer"
    ? raw
    : "consumer";
}

export function writeActiveRole(role: OnboardingRole) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
}

export function readOnboardingPending(): OnboardingPendingState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ONBOARDING_PENDING_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingPendingState) : null;
  } catch {
    return null;
  }
}

export function writeOnboardingPending(state: OnboardingPendingState | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!state) {
    window.localStorage.removeItem(ONBOARDING_PENDING_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    ONBOARDING_PENDING_STORAGE_KEY,
    JSON.stringify(state)
  );
}

export function clearConsumerSession() {
  writeAuthToken(null);
  writeConsumerAccount(null);
  clearSavedVenueIds();
  writeOnboardingPending(null);
}
