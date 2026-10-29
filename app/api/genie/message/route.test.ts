import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const xanoFetch = vi.fn();
const scheduleLearnFromMessage = vi.fn();

vi.mock("@/app/lib/server/xanoProxy", () => ({
  xanoFetch: (...args: unknown[]) => xanoFetch(...args),
  XanoError: class XanoError extends Error {
    status = 500;
    body: unknown = null;
  },
}));
vi.mock("@/app/lib/server/learnFromMessage", () => ({
  scheduleLearnFromMessage: (...args: unknown[]) => scheduleLearnFromMessage(...args),
}));
vi.mock("@/app/lib/server/requestAuth", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue(null),
}));

import { POST } from "./route";

function venue(id: number) {
  return { id, venue_name: `Venue ${id}`, image_fallback_url: `https://img/${id}.jpg` };
}

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/genie/message", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// A conversation v1 request turn as the chat endpoint returns it (4200 / 4369, 1.7.0).
const requestTurn = {
  reply: "Here are three rooftop spots.",
  venues: [venue(1), venue(2), venue(3), venue(4), venue(5), venue(6), venue(7)],
  more_nearby_venues: [venue(4), venue(5)],
  events: [],
  query_mode: "venue",
  reply_mode: "has_results",
  session_id: 12,
  session_token: "token-from-xano",
  conversation_id: "token-from-xano",
  turn_kind: "request",
  turn_index: 1,
  request_index: 1,
  refers_to_request_index: null,
  turn_venues: [venue(1), venue(2), venue(3)],
  turn_events: [],
  pick_reasons: [{ kind: "venue", venue_id: 1, venue_name: "Venue 1", reason: "Rooftop views." }],
};

describe("POST /api/genie/message", () => {
  beforeEach(() => {
    xanoFetch.mockReset();
    scheduleLearnFromMessage.mockReset();
  });

  it("forwards new_conversation and turn_hint to the chat endpoint", async () => {
    xanoFetch.mockResolvedValue(requestTurn);
    await POST(request({ message: "rooftop bar", new_conversation: true, turn_hint: "request" }));

    expect(xanoFetch).toHaveBeenCalledTimes(1);
    const [path, init] = xanoFetch.mock.calls[0];
    expect(path).toBe("genie/ep_genie_chat_v2_dev");
    expect(init.body).toMatchObject({ message: "rooftop bar", new_conversation: true, turn_hint: "request" });
  });

  it("drops an unknown turn_hint and a non-boolean new_conversation", async () => {
    xanoFetch.mockResolvedValue(requestTurn);
    await POST(request({ message: "hi", new_conversation: "yes", turn_hint: "whatever" }));

    const init = xanoFetch.mock.calls[0][1];
    expect(init.body.new_conversation).toBeUndefined();
    expect(init.body.turn_hint).toBeUndefined();
  });

  it("passes the conversation fields through", async () => {
    xanoFetch.mockResolvedValue(requestTurn);
    const res = await POST(request({ message: "rooftop bar" }));
    const json = await res.json();

    expect(json).toMatchObject({
      conversation_id: "token-from-xano",
      session_token: "token-from-xano",
      turn_kind: "request",
      turn_index: 1,
      request_index: 1,
      refers_to_request_index: null,
      turn_events: [],
      pick_reasons: requestTurn.pick_reasons,
    });
    expect(json.turn_venues.map((v: { id: number }) => v.id)).toEqual([1, 2, 3]);
    expect(json.turn_venues[0].image_primary_url).toBe("https://img/1.jpg");
  });

  it("uses the endpoint's more_nearby_venues when it sends them", async () => {
    xanoFetch.mockResolvedValue(requestTurn);
    const json = await (await POST(request({ message: "rooftop bar" }))).json();

    expect(json.venues.map((v: { id: number }) => v.id)).toEqual([1, 2, 3]);
    expect(json.more_nearby_venues.map((v: { id: number }) => v.id)).toEqual([4, 5]);
  });

  it("maps a follow-up turn", async () => {
    xanoFetch.mockResolvedValue({
      ...requestTurn,
      reply: "The first one has a patio.",
      venues: [venue(1), venue(2), venue(3)],
      more_nearby_venues: [],
      reply_mode: "followup",
      turn_kind: "followup",
      turn_index: 2,
      request_index: null,
      refers_to_request_index: 1,
    });
    const json = await (await POST(request({ message: "which has a patio?", session_token: "token-from-xano" }))).json();

    expect(json).toMatchObject({ turn_kind: "followup", turn_index: 2, request_index: null, refers_to_request_index: 1 });
    expect(xanoFetch.mock.calls[0][1].body.session_token).toBe("token-from-xano");
  });

  it("still maps the old response shape (no conversation fields)", async () => {
    xanoFetch.mockResolvedValue({
      reply: "Old reply",
      venues: [venue(1), venue(2), venue(3), venue(4), venue(5)],
      query_mode: "venue",
      session_token: "old-token",
    });
    const json = await (await POST(request({ message: "bar" }))).json();

    expect(json.reply).toBe("Old reply");
    expect(json.venues).toHaveLength(3);
    expect(json.more_nearby_venues.map((v: { id: number }) => v.id)).toEqual([4, 5]);
    expect(json.turn_kind).toBeUndefined();
    expect(json.turn_venues).toEqual([]);
    expect(json.pick_reasons).toEqual([]);
    expect(json.request_index).toBeNull();
  });

  it("schedules learning with the token from the reply", async () => {
    xanoFetch.mockResolvedValue(requestTurn);
    await POST(request({ message: "I love rooftops", previous_reply: "Earlier picks", device_id: "dev-1" }));

    expect(scheduleLearnFromMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "I love rooftops",
        previousReply: "Earlier picks",
        deviceId: "dev-1",
        sessionToken: "token-from-xano",
      })
    );
  });
});
