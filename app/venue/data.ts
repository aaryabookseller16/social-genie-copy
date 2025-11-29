// app/venue/data.ts

export type Venue = {
  id: string;
  name: string;
  image: string;
  address: string;
  description: string;
  vibe: string;
  hours: string;
};

const GENIE_API_URL = "https://xwpg-kuah-brlj.n7d.xano.io/api:mY7zYhwk/genie_v1";

type GenieApiVenue = {
  id: number;
  venue_name: string;
  area_neighborhood: string | null;
  city: string | null;
  energy_level: string | null;
  crowd: string | null;
  music: string | null;
  patio: string | null;
  hookah: string | null;
  price_band: string | null;
  black_owned: string | null;
  best_time_to_go: string | null;
  vibe_notes: string | null;
  instagram_handle: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  image_primary_url: string | null;
  image_fallback_url: string | null;
  vibe_score: number;
  match_confidence: number;
};

type GenieApiResponse = {
  results: GenieApiVenue[];
};

export async function fetchGenieVenues(params?: {
  limit?: number;
  energy_level_filter?: string;
  music_filter?: string;
  crowd_filter?: string;
}): Promise<Venue[]> {
  const searchParams = new URLSearchParams();

  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.energy_level_filter)
    searchParams.set("energy_level_filter", params.energy_level_filter);
  if (params?.music_filter)
    searchParams.set("music_filter", params.music_filter);
  if (params?.crowd_filter)
    searchParams.set("crowd_filter", params.crowd_filter);

  const url =
    searchParams.toString().length > 0
      ? `${GENIE_API_URL}?${searchParams.toString()}`
      : GENIE_API_URL;

  const res = await fetch(url, {
    // important so Genie is always fresh
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Genie API request failed: ${res.status}`);
  }

  const data = (await res.json()) as GenieApiResponse;

  // Map Genie’s full object → the smaller Venue object your UI expects
  return data.results.map((v) => ({
    id: String(v.id),
    name: v.venue_name ?? "Unknown venue",
    image:
      v.image_primary_url ||
      v.image_fallback_url ||
      "/sample-venue-1.jpeg", // fallback image in /public
    address:
      v.address ||
      [v.area_neighborhood, v.city].filter(Boolean).join(" • ") ||
      "",
    description: v.vibe_notes ?? "",
    vibe: [
      v.energy_level,
      v.crowd,
      v.music,
      v.price_band,
      v.black_owned === "Yes" ? "Black-owned" : null,
      v.patio === "Yes" ? "Patio" : null,
      v.hookah === "Yes" ? "Hookah" : null,
    ]
      .filter(Boolean)
      .join(" • "),
    hours: v.best_time_to_go ?? "",
  }));
}

