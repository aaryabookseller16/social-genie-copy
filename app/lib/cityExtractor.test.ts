import { describe, expect, it } from "vitest";

import { extractCityFromMessage, mentionsNearMe } from "./cityExtractor";

describe("extractCityFromMessage", () => {
  it("detects a city in a natural-language query regardless of casing", () => {
    expect(extractCityFromMessage("rooftop bars in Houston")).toBe("Houston");
    expect(extractCityFromMessage("BRUNCH IN chicago")).toBe("Chicago");
  });

  it("maps aliases to canonical city names", () => {
    expect(extractCityFromMessage("jazz in NYC")).toBe("New York");
    expect(extractCityFromMessage("dinner in New York City")).toBe("New York");
    expect(extractCityFromMessage("weekend in NOLA")).toBe("New Orleans");
  });

  it("does not match a city name inside another word", () => {
    expect(extractCityFromMessage("galaxy themed bars")).toBeNull();
    expect(extractCityFromMessage("somewhere fun")).toBeNull();
    expect(extractCityFromMessage("")).toBeNull();
  });
});

describe("mentionsNearMe", () => {
  it("recognizes a near-me request with flexible spacing and casing", () => {
    expect(mentionsNearMe("Places NEAR   ME tonight")).toBe(true);
    expect(mentionsNearMe("A neighborhood near meadows")).toBe(false);
  });
});
