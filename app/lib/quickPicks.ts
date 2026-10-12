/**
 * Quick-pick onboarding cards (GEN-012, docs/genie_plan.md 5.6.1).
 *
 * Each card is a scenario that maps to existing social-profile tag values.
 * Picks are saved as `source = stated` preferences in the user context.
 * No card uses the sensitive categories (music, community).
 */

export type QuickPickPreference = {
  category: "experience" | "atmosphere" | "food";
  value: string;
};

export type QuickPickCard = {
  id: string;
  label: string;
  preferences: QuickPickPreference[];
};

export const QUICK_PICK_CARDS: readonly QuickPickCard[] = [
  {
    id: "rooftop_happy_hour",
    label: "Rooftop happy hour",
    preferences: [
      { category: "atmosphere", value: "Rooftop" },
      { category: "experience", value: "Happy Hour" },
    ],
  },
  {
    id: "late_night_live_music",
    label: "Late-night live music",
    preferences: [
      { category: "experience", value: "Late Night" },
      { category: "experience", value: "Live Band" },
    ],
  },
  {
    id: "brunch_mimosas",
    label: "Brunch with mimosas",
    preferences: [
      { category: "experience", value: "Brunch" },
      { category: "food", value: "Bottomless Mimosas" },
    ],
  },
  {
    id: "speakeasy_cocktails",
    label: "Speakeasy cocktails",
    preferences: [
      { category: "atmosphere", value: "Speakeasy Vibe" },
      { category: "food", value: "Signature Cocktails" },
    ],
  },
  {
    id: "game_trivia_night",
    label: "Game or trivia night",
    preferences: [
      { category: "experience", value: "Game Night" },
      { category: "experience", value: "Trivia Night" },
    ],
  },
  {
    id: "day_party",
    label: "Day party with a DJ",
    preferences: [
      { category: "experience", value: "Day Party" },
      { category: "atmosphere", value: "Live DJ" },
    ],
  },
  {
    id: "chill_dinner",
    label: "Chill, cozy dinner",
    preferences: [
      { category: "atmosphere", value: "Chill & Intimate" },
      { category: "atmosphere", value: "Indoor Cozy" },
    ],
  },
  {
    id: "street_food",
    label: "Street food crawl",
    preferences: [{ category: "food", value: "Street Food" }],
  },
];

/** Preferences for the picked card ids, in card order, without duplicates. */
export function preferencesForCards(cardIds: readonly string[]): QuickPickPreference[] {
  const picked = new Set(cardIds);
  const seen = new Set<string>();
  const result: QuickPickPreference[] = [];

  for (const card of QUICK_PICK_CARDS) {
    if (!picked.has(card.id)) {
      continue;
    }
    for (const preference of card.preferences) {
      const key = `${preference.category}:${preference.value.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(preference);
      }
    }
  }

  return result;
}
