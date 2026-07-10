const SIGNUP_PROMPT_STORAGE_KEY = "genie_signup_prompt_v1";

export type SignupPromptTriggerReason =
  | "venue_tap"
  | "save_attempt"
  | "checkin_attempt"
  | "repeated_browse"
  | "second_query"
  | "shared_venue_tap";

export type SignupPromptState = {
  dismissCount: number;
  lastTriggerReason?: SignupPromptTriggerReason;
  lastShownAt?: number;
};

export function readSignupPromptState(): SignupPromptState {
  if (typeof window === "undefined") {
    return { dismissCount: 0 };
  }

  try {
    const raw = window.localStorage.getItem(SIGNUP_PROMPT_STORAGE_KEY);
    if (!raw) {
      return { dismissCount: 0 };
    }

    const parsed = JSON.parse(raw) as SignupPromptState;
    return {
      dismissCount: parsed.dismissCount ?? 0,
      lastTriggerReason: parsed.lastTriggerReason,
      lastShownAt: parsed.lastShownAt,
    };
  } catch {
    return { dismissCount: 0 };
  }
}

export function writeSignupPromptState(state: SignupPromptState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SIGNUP_PROMPT_STORAGE_KEY,
    JSON.stringify(state)
  );
}

export function shouldSuppressSignupPrompt(suppressAfter: number) {
  return readSignupPromptState().dismissCount >= suppressAfter;
}
