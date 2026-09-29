import { describe, expect, it } from "vitest";

import { scoreVenueMatch } from "./xanoCatalog";
import type { RawGenieVenue } from "../genieTypes";

const venue: RawGenieVenue = {
  id: 1,
  venue_name: "The Rooftop",
  address: "120 Main Street",
  area_neighborhood: "Midtown",
};

describe("scoreVenueMatch", () => {
  it.each([
    ["  THE ROOFTOP  ", 400],
    ["the roof", 300],
    ["rooftop", 200],
    ["main street", 120],
    ["midtown", 90],
    ["no match", 0],
  ])("scores %j as %i", (query, expected) => {
    expect(scoreVenueMatch(venue, query)).toBe(expected);
  });

  it("handles missing address and neighborhood fields", () => {
    expect(scoreVenueMatch({ id: 2, venue_name: "Cafe" }, "main")).toBe(0);
  });
});
