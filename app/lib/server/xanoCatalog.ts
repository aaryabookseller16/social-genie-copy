import { type RawGenieVenue } from "../genieTypes";

const GENIE_VENUES_URL =
  process.env.XANO_GENIE_VENUES_URL ||
  "https://xwpg-kuah-brlj.n7d.xano.io/api:mY7zYhwk/genie_v1";

export async function fetchCatalogVenues(limit = 200): Promise<RawGenieVenue[]> {
  const url = new URL(GENIE_VENUES_URL);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("energy_level_filter", "");
  url.searchParams.set("music_filter", "");
  url.searchParams.set("crowd_filter", "");

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Genie catalog: ${response.status}`);
  }

  const data = (await response.json()) as { results?: RawGenieVenue[] };
  return data.results ?? [];
}

function scoreVenueMatch(venue: RawGenieVenue, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const venueName = venue.venue_name.toLowerCase();
  const address = venue.address?.toLowerCase() ?? "";
  const neighborhood = venue.area_neighborhood?.toLowerCase() ?? "";

  if (venueName === normalizedQuery) {
    return 400;
  }

  if (venueName.startsWith(normalizedQuery)) {
    return 300;
  }

  if (venueName.includes(normalizedQuery)) {
    return 200;
  }

  if (address.includes(normalizedQuery)) {
    return 120;
  }

  if (neighborhood.includes(normalizedQuery)) {
    return 90;
  }

  return 0;
}

export async function searchCatalogVenues(query: string, limit = 8) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) {
    return [] as RawGenieVenue[];
  }

  const venues = await fetchCatalogVenues(400);
  return venues
    .map((venue) => ({
      venue,
      score: scoreVenueMatch(venue, normalizedQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.venue);
}

export async function fetchCatalogVenuesByIds(ids: number[]) {
  if (!ids.length) {
    return [] as RawGenieVenue[];
  }

  const wanted = new Set(ids.map(String));
  const venues = await fetchCatalogVenues(500);
  return venues.filter((venue) => wanted.has(String(venue.id)));
}

export async function fetchCatalogVenueById(id: string | number) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return null;
  }

  const matches = await fetchCatalogVenuesByIds([numericId]);
  return matches[0] ?? null;
}
