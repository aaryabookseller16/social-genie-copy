// Detects an explicit city reference in a user message (e.g. "happy hour in
// Houston"). When one is found it takes priority over device geolocation so
// the user's typed city — not where their phone happens to be — drives the
// search.

type CityEntry = { canonical: string; aliases: string[] };

const KNOWN_CITIES: CityEntry[] = [
  { canonical: "Houston", aliases: ["Houston"] },
  {
    canonical: "New York",
    aliases: ["New York City", "New York", "NYC", "Manhattan", "Brooklyn"],
  },
  { canonical: "Los Angeles", aliases: ["Los Angeles", "LA"] },
  { canonical: "Chicago", aliases: ["Chicago"] },
  { canonical: "Dallas", aliases: ["Dallas"] },
  { canonical: "Austin", aliases: ["Austin"] },
  { canonical: "San Antonio", aliases: ["San Antonio"] },
  { canonical: "San Francisco", aliases: ["San Francisco", "SF"] },
  { canonical: "Seattle", aliases: ["Seattle"] },
  { canonical: "Boston", aliases: ["Boston"] },
  { canonical: "Miami", aliases: ["Miami"] },
  { canonical: "Atlanta", aliases: ["Atlanta"] },
  { canonical: "Denver", aliases: ["Denver"] },
  { canonical: "Phoenix", aliases: ["Phoenix"] },
  { canonical: "Philadelphia", aliases: ["Philadelphia", "Philly"] },
  { canonical: "Nashville", aliases: ["Nashville"] },
  { canonical: "Portland", aliases: ["Portland"] },
  { canonical: "San Diego", aliases: ["San Diego"] },
  {
    canonical: "Washington DC",
    aliases: ["Washington DC", "Washington D.C.", "Washington"],
  },
  { canonical: "Las Vegas", aliases: ["Las Vegas", "Vegas"] },
  { canonical: "New Orleans", aliases: ["New Orleans", "NOLA"] },
  { canonical: "Orlando", aliases: ["Orlando"] },
  { canonical: "Tampa", aliases: ["Tampa"] },
  { canonical: "Tokyo", aliases: ["Tokyo"] },
  { canonical: "London", aliases: ["London"] },
  { canonical: "Paris", aliases: ["Paris"] },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ALIAS_INDEX: Array<{ canonical: string; pattern: RegExp }> = KNOWN_CITIES
  .flatMap(({ canonical, aliases }) =>
    aliases.map((alias) => ({ canonical, alias }))
  )
  // Match longer aliases first so "New York City" wins over "New York".
  .sort((a, b) => b.alias.length - a.alias.length)
  .map(({ canonical, alias }) => ({
    canonical,
    pattern: new RegExp(
      `(?:^|[^a-zA-Z])${escapeRegex(alias)}(?=[^a-zA-Z]|$)`,
      "i"
    ),
  }));

export function extractCityFromMessage(message: string): string | null {
  if (!message) return null;
  for (const { canonical, pattern } of ALIAS_INDEX) {
    if (pattern.test(message)) return canonical;
  }
  return null;
}

const NEAR_ME_PATTERN = /\bnear\s+me\b/i;

export function mentionsNearMe(message: string): boolean {
  return NEAR_ME_PATTERN.test(message);
}
