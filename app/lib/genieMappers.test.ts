import { describe, expect, it } from "vitest";

import {
  getVenueImage,
  mapVenue,
  normalizeHandleMessageResponse,
} from "./genieMappers";
import type { RawGenieVenue } from "./genieTypes";

const venue = (id: number): RawGenieVenue => ({
  id,
  venue_name: `Venue ${id}`,
});

describe("getVenueImage", () => {
  it("uses the first nonempty image in priority order", () => {
    expect(getVenueImage({
      ...venue(1),
      image_primary_url: " ",
      image_fallback_url: "fallback.jpg",
      image: "image.jpg",
      image_url: "last.jpg",
    })).toBe("fallback.jpg");

    expect(getVenueImage({
      ...venue(1),
      image_primary_url: "primary.jpg",
      image_fallback_url: "fallback.jpg",
    })).toBe("primary.jpg");
  });

  it("returns null when no image field is usable", () => {
    expect(getVenueImage({ ...venue(1), image: " " })).toBeNull();
  });
});

describe("mapVenue", () => {
  it("converts string coordinates and shares the selected image", () => {
    const result = mapVenue({
      ...venue(1),
      latitude: " 29.7604 ",
      longitude: "-95.3698",
      image_url: "venue.jpg",
    });

    expect(result).toMatchObject({
      latitude: 29.7604,
      longitude: -95.3698,
      image: "venue.jpg",
      image_url: "venue.jpg",
    });
  });

  it("uses null for missing or invalid coordinates", () => {
    expect(mapVenue({ ...venue(1), latitude: "unknown" })).toMatchObject({
      latitude: null,
      longitude: null,
      image: null,
    });
  });
});

describe("normalizeHandleMessageResponse", () => {
  it("normalizes a wrapped venues response and splits nearby results after three", () => {
    const result = normalizeHandleMessageResponse({
      result: {
        venues: [venue(1), venue(2), venue(3), venue(4)],
        use_xano: true,
        filters: { city: "Houston" },
      },
    }, "  rooftop bars  ");

    expect(result.decisive.map(({ id }) => id)).toEqual([1, 2, 3]);
    expect(result.more_nearby.map(({ id }) => id)).toEqual([4]);
    expect(result.response_mode).toBe("structured_results");
    expect(result.normalized_intent).toBe("rooftop bars");
    expect(result.city_context).toBe("Houston");
  });

  it("accepts top_venues and fills missing response fields", () => {
    const result = normalizeHandleMessageResponse({
      top_venues: [venue(1)],
      reply_mode: "has_results",
    }, "dinner");

    expect(result.decisive.map(({ id }) => id)).toEqual([1]);
    expect(result.reply).toBe("Genie is warming up a few ideas for you.");
    expect(result.filters).toEqual({
      city: null,
      energy: "",
      music: "",
      crowd: "",
      vibe_keywords: [],
    });
  });

  it("currently ignores more_venues when it is the only venue field", () => {
    // TODO: Include more_venues when the response mapper supports this Xano shape.
    const result = normalizeHandleMessageResponse({
      more_venues: [venue(2)],
      use_xano: true,
    }, "coffee");

    expect(result.decisive).toEqual([]);
    expect(result.more_nearby).toEqual([]);
    expect(result.response_mode).toBe("supported_no_results");
  });
});
