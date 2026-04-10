const SESSION_TOKEN_STORAGE_KEY = "genie_session_token";
const SESSION_ID_STORAGE_KEY = "genie_session_id";
const EXTERNAL_USER_ID_STORAGE_KEY = "genie_external_user_id";

export function readSessionToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) ?? "";
}

export function writeSessionToken(sessionToken?: string) {
  if (!sessionToken || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, sessionToken);
}

export function readSessionId(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.localStorage.getItem(SESSION_ID_STORAGE_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function writeSessionId(sessionId: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_ID_STORAGE_KEY, String(sessionId));
}

export function readExternalUserId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(EXTERNAL_USER_ID_STORAGE_KEY) ?? "";
}

export function writeExternalUserId(externalUserId: string) {
  if (!externalUserId || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EXTERNAL_USER_ID_STORAGE_KEY, externalUserId);
}

export function hasSession(): boolean {
  return Boolean(readSessionToken()) || Boolean(readExternalUserId());
}
