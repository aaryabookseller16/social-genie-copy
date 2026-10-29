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

describe("normalizeHandleMessageResponse conversation fields", () => {
  it("keeps the conversation v1 turn fields", () => {
    const result = normalizeHandleMessageResponse({
      reply: "The first one has a patio.",
      venues: [venue(1), venue(2), venue(3)],
      conversation_id: "conv-1",
      turn_kind: "followup",
      turn_index: 2,
      request_index: null,
      refers_to_request_index: 1,
      pick_reasons: [{ kind: "venue", venue_id: 1, reason: "Has a patio." }],
    }, "which has a patio?");

    expect(result.conversation_id).toBe("conv-1");
    expect(result.turn_kind).toBe("followup");
    expect(result.turn_index).toBe(2);
    expect(result.request_index).toBeNull();
    expect(result.refers_to_request_index).toBe(1);
    expect(result.pick_reasons).toEqual([{ kind: "venue", venue_id: 1, reason: "Has a patio." }]);
  });

  it("leaves them empty for an older response or an unknown turn kind", () => {
    const result = normalizeHandleMessageResponse({ reply: "Hi", turn_kind: "other" }, "hi");

    expect(result.turn_kind).toBeUndefined();
    expect(result.request_index).toBeNull();
    expect(result.refers_to_request_index).toBeNull();
    expect(result.pick_reasons).toEqual([]);
  });
});
