"use client";

/**
 * Xano Realtime — live delivery for Genie messaging.
 *
 * REST stays the source of truth; this is only the delivery layer. Channel
 * history is never replayed (a join always returns `history: []`), so anything
 * sent while the socket was down is missed — every consumer must re-fetch over
 * REST on `onResync`.
 *
 * Scope: producer threads (`genie_message_threads`) only. User-to-user DMs have
 * no realtime backend yet and stay on polling — see subscribeToThreadChannel's
 * callers.
 */

import { XanoClient, XanoObjectStorage } from "@xano/js-sdk";
import type { RawMessage } from "./publicApiClient";

const INSTANCE_BASE_URL = process.env.NEXT_PUBLIC_XANO_BASE_URL;
const REALTIME_CANONICAL = process.env.NEXT_PUBLIC_XANO_REALTIME_CANONICAL;

/** Payload of a server event, found at `action.payload.data`. */
export type GenieRealtimeEvent =
  | { event: "new_message"; thread_id: number; message: RawMessage }
  | { event: "unread_update"; thread_id: number; unread_count: number };

export type GenieChannelHandlers = {
  /** A validated server event. Client-sent frames never reach this. */
  onEvent: (event: GenieRealtimeEvent) => void;
  /**
   * The socket (re)connected after having dropped. Channel history is not
   * replayed, so the caller MUST re-run its initial REST fetch here or it will
   * silently miss everything sent during the gap.
   */
  onResync?: () => void;
  /**
   * The server rejected or failed the channel (verified live: a bad/anonymous
   * join answers with `action: "error"`, e.g. "Anonymous clients cannot join
   * this channel"). Delivery is not coming, so callers with a polling fallback
   * should switch to it rather than sit on a dead channel.
   */
  onError?: (error: unknown) => void;
};

/** Unsubscribe; leaves the channel and stops delivery. */
export type Unsubscribe = () => void;

/**
 * The SDK keeps one shared socket per page, and the token is sent as the
 * WebSocket subprotocol at connect time — so a single client is reused and the
 * socket is recycled when the token changes (logout / account switch).
 */
let client: XanoClient | null = null;
let clientToken: string | null = null;

function getRealtimeClient(authToken: string): XanoClient | null {
  // XanoClient's constructor and setRealtimeAuthToken touch storage, and the
  // socket needs a WebSocket global — browser only.
  if (typeof window === "undefined") return null;
  if (!INSTANCE_BASE_URL || !REALTIME_CANONICAL) {
    console.error(
      "[realtime] missing NEXT_PUBLIC_XANO_BASE_URL / NEXT_PUBLIC_XANO_REALTIME_CANONICAL — falling back to REST only"
    );
    return null;
  }

  if (!client) {
    client = new XanoClient({
      instanceBaseUrl: INSTANCE_BASE_URL,
      realtimeConnectionCanonical: REALTIME_CANONICAL,
      // In-memory storage: the SDK would otherwise persist a second copy of the
      // auth token to localStorage under its own key, which then outlives logout.
      storage: new XanoObjectStorage(),
    });
    client.setRealtimeAuthToken(authToken);
    clientToken = authToken;
    return client;
  }

  if (clientToken !== authToken) {
    // The live socket authenticated with the OLD token — swapping the config
    // alone changes nothing until it's rebuilt.
    client.setRealtimeAuthToken(authToken);
    clientToken = authToken;
    client.realtimeReconnect();
  }
  return client;
}

/** Raw frame off the wire. Deliberately untrusted — validate before use. */
type RealtimeFrame = {
  action?: string;
  options?: { channel?: string };
  payload?: { data?: unknown; row_id?: number; status?: string; message?: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * A server event we could not make sense of.
 *
 * Loud on purpose. Dropping these quietly is a trap: the SDK already swallows
 * error frames unless an error handler is passed as the SECOND argument to
 * `.on()`, so a silent drop here would stack a second invisible failure on top
 * of that one — "connected but no events" would look identical to "the payload
 * shape changed", with nothing in the console either way. The shapes below are
 * confirmed against live frames, so reaching this means something changed and
 * realtime is about to look silently dead.
 *
 * Logs structure only, never values — these payloads carry private message text.
 */
function reportUnparseableEvent(reason: string, data: unknown): void {
  console.error(
    `[realtime] dropped a server event — ${reason}. The backend payload shape may have ` +
      `changed; realtime will appear dead while REST still works. keys=` +
      (isRecord(data) ? JSON.stringify(Object.keys(data)) : typeof data)
  );
}

/**
 * Server events arrive as `action: "event"` with the useful bits nested at
 * `payload.data`.
 *
 * Only `"event"` is trusted: clients can emit `action: "message"` on these same
 * channels, so another participant could inject a message that never went
 * through the API. Anything that isn't a server event is dropped.
 *
 * Events are targeted per-user by the server (an outsider subscribed to someone
 * else's channel receives nothing), so there's no recipient filtering to do
 * here — if it arrived, it was addressed to us.
 */
function parseServerEvent(frame: RealtimeFrame): GenieRealtimeEvent | null {
  // Non-event frames are ordinary protocol traffic (join / leave / history /
  // presence) or a client-sent `message` frame we deliberately refuse to trust.
  // Ignoring those is expected, not an anomaly — stay quiet.
  if (frame.action !== "event") return null;

  const data = frame.payload?.data;
  if (!isRecord(data)) {
    reportUnparseableEvent("payload.data was not an object", data);
    return null;
  }

  if (data.event === "new_message") {
    if (!isRecord(data.message) || typeof data.message.id !== "number") {
      reportUnparseableEvent("new_message had no numeric message.id", data);
      return null;
    }
    return {
      event: "new_message",
      thread_id: Number(data.thread_id),
      message: data.message as unknown as RawMessage,
    };
  }

  if (data.event === "unread_update") {
    if (typeof data.thread_id !== "number" || typeof data.unread_count !== "number") {
      reportUnparseableEvent("unread_update lacked numeric thread_id/unread_count", data);
      return null;
    }
    // unread_count is the absolute new value, not an increment. 0 means cleared.
    return { event: "unread_update", thread_id: data.thread_id, unread_count: data.unread_count };
  }

  reportUnparseableEvent(`unrecognized event name "${String(data.event)}"`, data);
  return null;
}

/**
 * One entry per channel NAME, shared by every subscriber of that name.
 *
 * Reference counting is not an optimization here, it's a correctness
 * requirement: `channel.destroy()` sends a `leave` for the channel name over the
 * one shared socket while removing only its own observer. If two components
 * subscribed to the same name (e.g. the inbox list and the badge both watching
 * `user/<id>`), the first to unmount would leave the channel and silently kill
 * delivery for the other. So we hold a single underlying channel per name and
 * only destroy it once the last subscriber has gone.
 */
type ChannelEntry = {
  channel: ReturnType<XanoClient["channel"]>;
  handlers: Set<GenieChannelHandlers>;
  sawDisconnect: boolean;
};

const entries = new Map<string, ChannelEntry>();

/**
 * Subscribes to a channel name returned by the API.
 *
 * `channelName` MUST come from a `realtime_channel` field on an
 * `ep_get_threads_dev` / `ep_get_messages_dev` response — never built from ids.
 * The `thread/<key>` form embeds a per-conversation secret that the API only
 * hands to verified participants; it is the subscribe capability, so it must
 * never be logged, put in a URL, or shared across users.
 *
 * Returns null when realtime is unavailable (SSR, missing config, no token) —
 * callers must keep their REST path working for that case.
 */
export function subscribeToGenieChannel(
  channelName: string,
  authToken: string | null,
  handlers: GenieChannelHandlers,
  options: { presence?: boolean } = {}
): Unsubscribe | null {
  if (!channelName || !authToken) return null;

  const xano = getRealtimeClient(authToken);
  if (!xano) return null;

  let entry = entries.get(channelName);

  if (!entry) {
    try {
      const channel = xano.channel(channelName, { presence: options.presence ?? false });
      const created: ChannelEntry = { channel, handlers: new Set(), sawDisconnect: false };

      // A catch-all handler with BOTH arguments: the SDK routes errors only to
      // the second argument, and an action-filtered handler never sees them
      // ("error" !== "event"), so filtering here would swallow failures.
      channel.on(
        (frame: RealtimeFrame) => {
          if (frame.action === "connection_status") {
            const status = frame.payload?.status;
            if (status === "disconnected") {
              created.sawDisconnect = true;
              return;
            }
            // Only resync once the socket has actually dropped — the first
            // `connected` lands right after subscribing, when the subscriber's
            // initial REST fetch has already run.
            if (status === "connected" && created.sawDisconnect) {
              created.sawDisconnect = false;
              // The SDK re-joins automatically, but the gap's messages are gone
              // for good — only REST can fill them back in.
              for (const h of created.handlers) h.onResync?.();
            }
            return;
          }

          const event = parseServerEvent(frame);
          if (!event) return;
          for (const h of created.handlers) h.onEvent(event);
        },
        (err: unknown) => {
          // Never log the frame itself — a thread channel name is a capability.
          // The SDK routes errors ONLY here; without this they vanish silently.
          console.error(
            "[realtime] channel error",
            (err as RealtimeFrame | undefined)?.payload?.message ?? err
          );
          for (const h of created.handlers) {
            // Let the subscriber fall back (a rejected join never delivers), and
            // reconcile once over REST either way.
            h.onError?.(err);
            h.onResync?.();
          }
        }
      );

      entry = created;
      entries.set(channelName, created);
    } catch (err) {
      console.error("[realtime] failed to subscribe", err);
      return null;
    }
  }

  const active = entry;
  active.handlers.add(handlers);

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    active.handlers.delete(handlers);
    if (active.handlers.size > 0) return;
    entries.delete(channelName);
    try {
      active.channel.destroy();
    } catch (err) {
      console.error("[realtime] failed to unsubscribe", err);
    }
  };
}
