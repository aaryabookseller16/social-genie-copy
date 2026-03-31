const SESSION_TOKEN_STORAGE_KEY = "genie_session_token";

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
