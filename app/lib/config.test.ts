import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("OneSignal config", () => {
  it("keeps the current app ID when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_ONESIGNAL_APP_ID", "");
    vi.resetModules();
    const { ONE_SIGNAL_APP_ID } = await import("./config");
    expect(ONE_SIGNAL_APP_ID).toBe("2b0988a9-9a1e-4039-9131-e4859ea641e2");
  });

  it("uses the public app ID override", async () => {
    vi.stubEnv("NEXT_PUBLIC_ONESIGNAL_APP_ID", "sandbox-app-id");
    vi.resetModules();
    const { ONE_SIGNAL_APP_ID } = await import("./config");
    expect(ONE_SIGNAL_APP_ID).toBe("sandbox-app-id");
  });
});
