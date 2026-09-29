import { afterEach, describe, expect, it, vi } from "vitest";

const variables = [
  "XANO_BASE_URL",
  "XANO_GENIE_DEV_BASE",
  "XANO_AUTH_BASE",
  "XANO_STRIPE_BASE",
  "XANO_GENIE_VENUES_URL",
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("server Xano config", () => {
  it("keeps the existing production URLs when variables are unset", async () => {
    for (const variable of variables) vi.stubEnv(variable, "");
    vi.resetModules();

    const config = await import("./config");
    expect(config.XANO_GENIE_BASE).toBe(
      "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e"
    );
    expect(config.XANO_AUTH_BASE).toBe(
      "https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8"
    );
    expect(config.XANO_STRIPE_BASE).toBe(
      "https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY"
    );
    expect(config.XANO_GENIE_VENUES_URL).toBe(
      "https://xwpg-kuah-brlj.n7d.xano.io/api:mY7zYhwk/genie_v1"
    );
  });

  it("derives all default paths from an overridden origin", async () => {
    for (const variable of variables) vi.stubEnv(variable, "");
    vi.stubEnv("XANO_BASE_URL", "https://sandbox.example.test");
    vi.resetModules();

    const config = await import("./config");
    expect(config.XANO_GENIE_BASE).toBe(
      "https://sandbox.example.test/api:pgMKWi2e"
    );
    expect(config.XANO_GENIE_VENUES_URL).toBe(
      "https://sandbox.example.test/api:mY7zYhwk/genie_v1"
    );
  });

  it("lets each specific Xano URL override the origin", async () => {
    vi.stubEnv("XANO_BASE_URL", "https://unused.example.test");
    vi.stubEnv("XANO_GENIE_DEV_BASE", "https://genie.example.test");
    vi.stubEnv("XANO_AUTH_BASE", "https://auth.example.test");
    vi.stubEnv("XANO_STRIPE_BASE", "https://stripe.example.test");
    vi.stubEnv("XANO_GENIE_VENUES_URL", "https://venues.example.test");
    vi.resetModules();

    const config = await import("./config");
    expect(config.XANO_GENIE_BASE).toBe("https://genie.example.test");
    expect(config.XANO_AUTH_BASE).toBe("https://auth.example.test");
    expect(config.XANO_STRIPE_BASE).toBe("https://stripe.example.test");
    expect(config.XANO_GENIE_VENUES_URL).toBe("https://venues.example.test");
  });
});
