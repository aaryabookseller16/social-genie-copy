import type { RawGenieVenue, RawHandleMessageResponse } from "./genieTypes";

/** Longest summary sent back to the server, so a long reply never bloats the request. */
export const MAX_REPLY_SUMMARY_CHARS = 1200;

const MAX_VENUES = 5;

function cuisineList(venue: RawGenieVenue): string[] {
  return Array.isArray(venue.cuisine_tags)
    ? venue.cuisine_tags.filter((tag): tag is string => typeof tag === "string")
    : [];
}

function describeVenue(venue: RawGenieVenue, index: number): string {
  const details = [
    ...cuisineList(venue).map((tag) => tag.replace(/_/g, " ")),
    venue.energy_level,
    venue.price_band ? `price ${venue.price_band}` : null,
    venue.vibe_notes ? venue.vibe_notes.slice(0, 120) : null,
  ].filter((detail): detail is string => Boolean(detail && detail.trim()));

  return `${index + 1}. ${venue.venue_name}${details.length ? ` (${details.join(", ")})` : ""}`;
}

/**
 * Summarizes a Genie reply so the next message can be understood in context
 * ("love the first one", "those look too pricey"). Used only to learn the
 * user's likes and dislikes (GEN-014); never shown to the user.
 */
export function buildReplySummary(response: RawHandleMessageResponse | null | undefined): string {
  if (!response) return "";

  const venues = (response.venues ?? response.top_venues ?? []).slice(0, MAX_VENUES);
  const parts = [
    typeof response.reply === "string" ? response.reply.trim() : "",
    venues.length ? `Venues shown: ${venues.map(describeVenue).join(" ")}` : "",
  ].filter(Boolean);

  return parts.join("\n").slice(0, MAX_REPLY_SUMMARY_CHARS);
}
