export type GenieRequest = {
  message: string;
  channel?: string;
  external_user_id: string;
  user_name?: string | null;
  city_context?: string | null;

  // optional pass-throughs (safe to include)
  session_token?: string | null;
  user_data?: any;
  meta?: any;
  debug?: boolean;
  entry_point?: string | null;
  entry_context_id?: string | null;
};

export type GenieResponse = {
  reply: string | any; // can be string or debug object if you trigger __DBG:*
  use_xano: boolean;
  filters: any;
  profile_prompt: string | null;
  error: any;
  debug?: any;
};

export async function sendToGenie(payload: GenieRequest): Promise<GenieResponse> {
  const url = process.env.NEXT_PUBLIC_GENIE_API_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_GENIE_API_URL");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Genie returned non-JSON: ${text}`);
  }

  if (!res.ok) {
    throw new Error(`Genie HTTP ${res.status}: ${JSON.stringify(data)}`);
  }

  return data as GenieResponse;
}

