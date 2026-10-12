import { describe, expect, it } from "vitest";

import { QUICK_PICK_CARDS, preferencesForCards } from "./quickPicks";

describe("QUICK_PICK_CARDS", () => {
  it("has 6 to 8 cards with unique ids", () => {
    expect(QUICK_PICK_CARDS.length).toBeGreaterThanOrEqual(6);
    expect(QUICK_PICK_CARDS.length).toBeLessThanOrEqual(8);
    expect(new Set(QUICK_PICK_CARDS.map((card) => card.id)).size).toBe(
      QUICK_PICK_CARDS.length
    );
  });

  it("never uses the sensitive music or community categories", () => {
    const categories = QUICK_PICK_CARDS.flatMap((card) =>
      card.preferences.map((preference) => preference.category as string)
    );
    expect(categories).not.toContain("music");
    expect(categories).not.toContain("community");
  });
});

describe("preferencesForCards", () => {
  it("returns the preferences of the picked cards in card order", () => {
    expect(preferencesForCards(["street_food", "rooftop_happy_hour"])).toEqual([
      { category: "atmosphere", value: "Rooftop" },
      { category: "experience", value: "Happy Hour" },
      { category: "food", value: "Street Food" },
    ]);
  });

  it("ignores unknown ids and returns nothing for no picks", () => {
    expect(preferencesForCards(["not_a_card"])).toEqual([]);
    expect(preferencesForCards([])).toEqual([]);
  });

  it("drops duplicate preferences across cards", () => {
    const all = preferencesForCards(QUICK_PICK_CARDS.map((card) => card.id));
    const keys = all.map((p) => `${p.category}:${p.value.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
