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
