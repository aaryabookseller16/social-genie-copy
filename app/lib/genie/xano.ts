import "server-only";
import type { GenieResponse } from "./types";

const BASE = process.env.NEXT_PUBLIC_XANO_BASE_URL;

if (!BASE) throw new Error("Missing NEXT_PUBLIC_XANO_BASE_URL");

export async function sendGenieMessage(input: {
  message: string;
  external_user_id: string;
  lat?: number | null;
  lng?: number | null;
  radius_meters?: number | null;
  location_label?: string | null;
  session_token?: string | null;
}): Promise<GenieResponse> {
  const res = await fetch(`${BASE}/genie/handle_message_dev`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      message: input.message,
      channel: "web",
      external_user_id: input.external_user_id,
      session_token: input.session_token ?? "",
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      radius_meters: input.radius_meters ?? 2000,
      location_label: input.location_label ?? "",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Xano error ${res.status}: ${text}`);
  }

  return res.json();
}