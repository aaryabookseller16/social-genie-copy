import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: vi.fn() }));

import { MAX_PREVIOUS_REPLY_CHARS, scheduleLearnFromMessage } from "./learnFromMessage";

function runNow() {
  const tasks: Array<() => Promise<void>> = [];
  return {
    schedule: (task: () => Promise<void>) => {
      tasks.push(task);
    },
    run: () => Promise.all(tasks.map((task) => task())),
    count: () => tasks.length,
  };
}

describe("scheduleLearnFromMessage", () => {
  it("schedules one learn call with the message, previous reply, user and device", async () => {
    const scheduler = runNow();
    const fetcher = vi.fn().mockResolvedValue({ saved: [] });

    const scheduled = scheduleLearnFromMessage(
      {
        message: "  i dont like happy hours  ",
        previousReply: "Here are three bars.",
        externalUserId: "web_guest",
        deviceId: "device-1",
        sessionToken: "token-1",
      },
      scheduler.schedule,
      fetcher
    );

    expect(scheduled).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
    await scheduler.run();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("genie/ep_learn_from_message_dev", {
      method: "POST",
      body: {
        message: "i dont like happy hours",
        previous_reply: "Here are three bars.",
        external_user_id: "web_guest",
        device_id: "device-1",
        session_token: "token-1",
      },
    });
  });

  it("does nothing for an empty message", () => {
    const scheduler = runNow();
    const fetcher = vi.fn();

    expect(scheduleLearnFromMessage({ message: "   " }, scheduler.schedule, fetcher)).toBe(false);
    expect(scheduler.count()).toBe(0);
  });

  it("caps the previous reply and drops empty optional fields", async () => {
    const scheduler = runNow();
    const fetcher = vi.fn().mockResolvedValue({});

    scheduleLearnFromMessage(
      { message: "love it", previousReply: "x".repeat(4000) },
      scheduler.schedule,
      fetcher
    );
    await scheduler.run();

    const body = fetcher.mock.calls[0][1].body;
    expect(body.previous_reply).toHaveLength(MAX_PREVIOUS_REPLY_CHARS);
    expect(body.external_user_id).toBeUndefined();
    expect(body.device_id).toBeUndefined();
    expect(body.session_token).toBeUndefined();
  });

  it("swallows a failed learn call", async () => {
    const scheduler = runNow();
    const fetcher = vi.fn().mockRejectedValue(new Error("down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    scheduleLearnFromMessage({ message: "hi" }, scheduler.schedule, fetcher);
    await expect(scheduler.run()).resolves.toBeDefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
