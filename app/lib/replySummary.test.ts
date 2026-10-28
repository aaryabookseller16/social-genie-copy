import { describe, expect, it } from "vitest";

import { buildReplySummary, MAX_REPLY_SUMMARY_CHARS } from "./replySummary";

describe("buildReplySummary", () => {
  it("returns an empty string when there is no reply", () => {
    expect(buildReplySummary(null)).toBe("");
    expect(buildReplySummary({})).toBe("");
  });

  it("includes the reply text and the venues with their details", () => {
    const summary = buildReplySummary({
      reply: "Here are three chill bars.",
      venues: [
        {
          id: 1,
          venue_name: "Angel Share",
          cuisine_tags: ["signature_cocktails"],
          energy_level: "Chill",
          price_band: "$$",
          vibe_notes: "Speakeasy with a cozy feel.",
        },
        { id: 2, venue_name: "Lost & Found" },
      ],
    });

    expect(summary).toBe(
      "Here are three chill bars.\n" +
        "Venues shown: 1. Angel Share (signature cocktails, Chill, price $$, Speakeasy with a cozy feel.) " +
        "2. Lost & Found"
    );
  });

  it("ignores non-text cuisine tags", () => {
    const summary = buildReplySummary({
      venues: [{ id: 1, venue_name: "X", cuisine_tags: { bad: true } }],
    });
    expect(summary).toBe("Venues shown: 1. X");
  });

  it("caps the summary length", () => {
    const summary = buildReplySummary({ reply: "a".repeat(5000) });
    expect(summary.length).toBe(MAX_REPLY_SUMMARY_CHARS);
  });
});
