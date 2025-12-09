// lib/genieClient.ts

export interface GenieChatResponse {
  reply: string;
  session_token?: string;
  // keep everything else flexible for now
  [key: string]: any;
}

export async function callGenie(message: string): Promise<GenieChatResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_GENIE_API_URL;

  if (!apiUrl) {
    throw new Error("Genie API URL is not set (NEXT_PUBLIC_GENIE_API_URL).");
  }

  // Optional: basic session handling using localStorage
  let sessionToken: string | null = null;
  if (typeof window !== "undefined") {
    sessionToken = window.localStorage.getItem("genie_session_token");
  }

  const body = {
    message,
    channel: "web",
    external_user_id: "web_guest", // later: use real user id
    session_token: sessionToken || "",
    city_context: "houston",       // can be dynamic later
    user_data: {},
    meta: {},
    debug: false,
  };

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
  let errorBody: any = null;
  let text = "";

  try {
    errorBody = await res.json();
    text = JSON.stringify(errorBody);
  } catch {
    text = await res.text();
  }

  console.error("Genie API error", res.status, errorBody || text);

  // Return a soft failure instead of throwing
  return {
    reply:
      "I hit a glitch in my brain talking to the server. Try that request again in a bit.",
    error: errorBody || text,
  };
}

const data = await res.json();

  console.log("Genie Xano raw response:", data); // 👈 super useful while we’re testing

  // Try a few common shapes: {reply}, {result:{reply}}, etc.
  const reply =
    data.reply ??
    data.result?.reply ??
    "I reached Xano but didn’t find a clear reply field.";

  const newSessionToken = data.session_token ?? data.result?.session_token;

  if (newSessionToken && typeof window !== "undefined") {
    window.localStorage.setItem("genie_session_token", newSessionToken);
  }

  return {
    reply,
    session_token: newSessionToken,
    ...data,
  };
}

export type GenieFilters = {
  limit?: number;
  energy_level_filter?: string;
  music_filter?: string;
  crowd_filter?: string;
};

const GENIE_BASE_URL =
  "https://xwpg-kuah-brlj.n7d.xano.io/api:mY7zYhwk/genie_v1";

export async function fetchGenieVenues(filters: GenieFilters) {
  const params = new URLSearchParams();

  params.set("limit", String(filters.limit ?? 10));

  params.set("energy_level_filter", filters.energy_level_filter ?? "");
  params.set("music_filter", filters.music_filter ?? "");
  params.set("crowd_filter", filters.crowd_filter ?? "");

  const url = `${GENIE_BASE_URL}?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
  });

  const data = await res.json();
  return data.results ?? [];
}
