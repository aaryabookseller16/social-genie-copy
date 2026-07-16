"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { ScrollUnlock } from "@/app/p/[id]/ScrollUnlock";
import {
  blockUser,
  fetchBlockedUsers,
  fetchMessageThreads,
  fetchThreadMessages,
  markThreadRead,
  MAX_MESSAGE_LENGTH,
  mergeThreadsToConversations,
  replyAsProducer,
  reportUserProfile,
  sendMessage,
  unblockUser,
  type MessageThreadType,
  type RawMessage,
} from "@/app/lib/publicApiClient";
import { type ConsumerAccount } from "@/app/lib/localState";

const POLL_INTERVAL_MS = 4000;
const PER_PAGE = 30;
/** How close to the bottom (px) still counts as "at the bottom" for auto-scroll. */
const NEAR_BOTTOM_PX = 80;

function toMs(value: string | number): number {
  if (typeof value === "number") return value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/** A server message, optionally with client-only optimistic-send state. */
type DisplayMessage = RawMessage & { pending?: boolean; failed?: boolean; blocked?: boolean };

/** Union by id, sorted oldest→newest for top-to-bottom display. */
function mergeMessages<T extends RawMessage>(existing: T[], incoming: T[]): T[] {
  const byId = new Map<number, T>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => {
    const ta = toMs(a.created_at);
    const tb = toMs(b.created_at);
    if (ta !== tb) return ta - tb;
    return a.id - b.id;
  });
}

const sameDay = (a: number, b: number): boolean => {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

/** "Today" / "Yesterday" / "Mar 5" (adds year only if it differs from now). */
function dayLabel(ms: number): string {
  const now = Date.now();
  if (sameDay(ms, now)) return "Today";
  if (sameDay(ms, now - 86_400_000)) return "Yesterday";
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

type ViewerRole = "consumer" | "producer";

type Props = {
  account: ConsumerAccount | null;
  threadId: number | null;
  threadType: MessageThreadType;
  counterpartId: number;
  counterpartName?: string;
  counterpartAvatarUrl?: string;
  /** Only meaningful when threadType === "producer" — defaults to "consumer". */
  viewerRole?: ViewerRole;
  onBack: () => void;
  onThreadCreated: (threadId: number, viewerRole?: ViewerRole) => void;
};

function formatTime(createdAt: string | number): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function ConversationScreen({
  account,
  threadId,
  threadType,
  counterpartId,
  counterpartName,
  counterpartAvatarUrl,
  viewerRole = "consumer",
  onBack,
  onThreadCreated,
}: Props) {
  const isProducerOwnerReplying = threadType === "producer" && viewerRole === "producer";
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  // Set when the backend rejects a send because the OTHER person has blocked
  // us (as opposed to `isBlocked`, which is us having blocked them). Distinct
  // from a generic network/server failure — retrying will never succeed.
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportPicker, setShowReportPicker] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Mirrors loadingOlder so the poll can bail synchronously without a stale
  // closure — prevents a poll merge from fighting the load-older scroll offset.
  const loadingOlderRef = useRef(false);
  // Whether the user is currently scrolled to (near) the bottom — governs
  // whether an incoming message should auto-scroll or leave them where they are.
  const nearBottomRef = useRef(true);
  // Lowest page number currently loaded. The backend always sorts messages
  // oldest-first and paginates from page 1 = the oldest window (there's no
  // "give me the newest" sort option), so page 1 is the START of the thread,
  // not the end — loadOlder() walks this DOWN toward 1, not up.
  const oldestPageRef = useRef(1);
  // When set, a load-older just prepended rows: hold the pre-prepend scrollHeight
  // so the layout effect can restore the visual position (no jump).
  const pendingOlderAdjustRef = useRef<number | null>(null);
  // Request a scroll-to-bottom after the next messages render (initial load,
  // a message I sent, or a new incoming message while already at the bottom).
  const shouldScrollBottomRef = useRef(true);

  const markReadSafe = useCallback(() => {
    if (threadId === null) return;
    markThreadRead(threadType, threadId).catch(() => {});
  }, [threadId, threadType]);

  // onThreadCreated is a fresh function reference on every render of the
  // (large, frequently re-rendering) parent component. Keeping it in a ref
  // instead of a dependency array stops the resolve-existing-thread effect
  // below from being cancelled and re-run on every parent re-render before
  // it can finish — which previously meant it never got a chance to apply
  // its result, silently discarding real conversation history.
  const onThreadCreatedRef = useRef(onThreadCreated);
  useEffect(() => {
    onThreadCreatedRef.current = onThreadCreated;
  }, [onThreadCreated]);

  const loadMessages = useCallback(
    async (isInitial: boolean) => {
      if (threadId === null) return;
      if (isInitial) setLoading(true);
      try {
        // The backend sorts oldest-first and paginates from page 1 = the
        // oldest window, so page 1 stops holding the newest messages once a
        // thread grows past PER_PAGE. Learn the total first, then fetch
        // whichever page currently holds the tail of the conversation.
        const first = await fetchThreadMessages(threadType, threadId, 1, PER_PAGE);
        const total = first.total ?? (first.messages ?? []).length;
        const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
        const raw =
          lastPage === 1 ? first : await fetchThreadMessages(threadType, threadId, lastPage, PER_PAGE);
        const incoming = raw.messages ?? [];

        if (isInitial) {
          oldestPageRef.current = lastPage;
          setHasMore(lastPage > 1);
          shouldScrollBottomRef.current = true;
          setMessages(mergeMessages([], incoming));
          markReadSafe();
        } else {
          // Don't merge poll results while a load-older is in flight — the
          // prepend scroll-offset math would be thrown off by a concurrent
          // height change. The next poll (or visibility refresh) catches up.
          if (loadingOlderRef.current) return;
          setMessages((prev) => {
            const merged = mergeMessages(prev, incoming);
            if (merged.length > prev.length) {
              const newest = merged[merged.length - 1];
              const isIncoming = newest && newest.sender_id !== account?.id;
              if (isIncoming) {
                markReadSafe();
                if (nearBottomRef.current) shouldScrollBottomRef.current = true;
              }
            }
            return merged;
          });
        }
      } catch {
        if (isInitial) setError("This conversation could not be loaded.");
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [threadId, threadType, account?.id, markReadSafe]
  );

  const loadOlder = useCallback(() => {
    if (threadId === null || !hasMore || loadingOlder) return;
    if (oldestPageRef.current <= 1) return;
    const container = scrollRef.current;
    pendingOlderAdjustRef.current = container ? container.scrollHeight : null;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    // Page 1 is the oldest window (ascending sort), so "older" means walking
    // the page number DOWN, not up.
    const prevPage = oldestPageRef.current - 1;
    fetchThreadMessages(threadType, threadId, prevPage, PER_PAGE)
      .then((raw) => {
        const incoming = raw.messages ?? [];
        oldestPageRef.current = prevPage;
        if (prevPage <= 1) setHasMore(false);
        if (incoming.length > 0) {
          setMessages((prev) => mergeMessages(prev, incoming));
        } else {
          pendingOlderAdjustRef.current = null;
        }
      })
      .catch(() => {
        pendingOlderAdjustRef.current = null;
      })
      .finally(() => {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      });
  }, [threadId, threadType, hasMore, loadingOlder]);

  function handleScroll() {
    const c = scrollRef.current;
    if (!c) return;
    nearBottomRef.current = c.scrollHeight - c.scrollTop - c.clientHeight < NEAR_BOTTOM_PX;
    if (c.scrollTop < 60 && hasMore && !loadingOlder) {
      loadOlder();
    }
  }

  // A deep link (e.g. a producer profile's "Message" button) always arrives
  // with threadId === null, since it has no way to know whether a thread
  // with this counterpart already exists. Resolve that here before treating
  // it as a brand-new conversation — otherwise every visit "forgets" prior
  // history with the same person/producer.
  useEffect(() => {
    if (threadId !== null) return;
    let cancelled = false;
    fetchMessageThreads(threadType, 1, 100)
      .then((raw) => {
        if (cancelled) return;
        const existing = mergeThreadsToConversations(raw, account?.id).find(
          (c) => c.threadType === threadType && c.counterpartId === counterpartId
        );
        if (existing) {
          onThreadCreatedRef.current(existing.threadId, existing.viewerRole);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, threadType, counterpartId, account?.id]);

  useEffect(() => {
    if (threadId === null) return;
    const isVisible = () =>
      typeof document === "undefined" || document.visibilityState === "visible";
    // Opening a chat always loads it. But the repeated poll is gated on tab
    // visibility: reading a thread (ep_get_messages_dev) marks its messages read
    // as a side effect, so a backgrounded/unfocused conversation tab must NOT
    // keep polling — otherwise it silently "reads" incoming messages and the
    // recipient never sees an unread badge elsewhere.
    loadMessages(true);
    const interval = setInterval(() => {
      if (isVisible()) loadMessages(false);
    }, POLL_INTERVAL_MS);
    // When the user switches back to this tab, refresh immediately (and mark
    // read) rather than waiting for the next interval tick.
    const onVisible = () => {
      if (isVisible()) loadMessages(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [threadId, loadMessages]);

  useEffect(() => {
    fetchBlockedUsers()
      .then((r) => {
        setIsBlocked((r.blocked_user_ids ?? []).includes(counterpartId));
      })
      .catch(() => {});
  }, [counterpartId]);

  // This component instance is reused across different conversations (no
  // `key` prop from the parent), so per-conversation client state must be
  // reset explicitly when the counterpart changes.
  useEffect(() => {
    setBlockedByOther(false);
  }, [counterpartId]);

  // Auto-dismiss the transient action banner ("Blocked", "Report submitted", …).
  useEffect(() => {
    if (!actionMessage) return;
    const timer = setTimeout(() => setActionMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  // Escape closes the ⋮ menu / report sheet (outside-click is handled by the
  // menu backdrop in the markup below).
  useEffect(() => {
    if (!showMenu && !showReportPicker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowMenu(false);
        setShowReportPicker(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showMenu, showReportPicker]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    // A load-older prepend just happened: keep the same rows under the user's
    // eyes by offsetting scrollTop by the height that got added above.
    if (pendingOlderAdjustRef.current != null) {
      const prevHeight = pendingOlderAdjustRef.current;
      pendingOlderAdjustRef.current = null;
      container.scrollTop += container.scrollHeight - prevHeight;
      return;
    }
    if (shouldScrollBottomRef.current) {
      shouldScrollBottomRef.current = false;
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  function resetComposerHeight() {
    if (composerRef.current) composerRef.current.style.height = "auto";
  }

  async function handleSend() {
    const text = composerText.trim();
    if (!text || sending) return;
    if (isProducerOwnerReplying && threadId === null) return; // no thread to reply in

    // Optimistic bubble: show it immediately with a temporary negative id (never
    // collides with real server ids), reconcile on response.
    const tempId = -Date.now();
    const optimistic: DisplayMessage = {
      id: tempId,
      thread_id: threadId ?? 0,
      sender_id: account?.id ?? 0,
      recipient_id: counterpartId,
      recipient_type: threadType,
      message_text: text,
      is_read: false,
      created_at: Date.now(),
      pending: true,
    };
    setComposerText("");
    resetComposerHeight();
    setError(null);
    shouldScrollBottomRef.current = true;
    setMessages((prev) => mergeMessages(prev, [optimistic]));
    setSending(true);
    try {
      const result = isProducerOwnerReplying
        ? await replyAsProducer(threadId as number, text)
        : await sendMessage({
            recipientId: counterpartId,
            recipientType: threadType,
            text,
          });
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return result.message ? mergeMessages(withoutTemp, [result.message]) : withoutTemp;
      });
      if (threadId === null && result.thread_id) {
        onThreadCreated(result.thread_id, viewerRole);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send message.";
      // The backend rejects sends to someone who's blocked us (or who we've
      // blocked) with this exact text — see app/api/messages/*/route.ts and
      // the Xano ep_send_*/ep_producer_reply_dev block checks. Unlike a
      // network hiccup, retrying this will never succeed, so treat it
      // differently: hide the composer instead of inviting a retry.
      const isBlockRejection = message.toLowerCase().includes("cannot send messages to this user");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, pending: false, failed: true, blocked: isBlockRejection } : m
        )
      );
      if (isBlockRejection) {
        setBlockedByOther(true);
      } else {
        // Leave the bubble in place but mark it failed; restore the text so
        // the user can immediately retry.
        setComposerText((cur) => cur || text);
      }
      setError(message);
    } finally {
      setSending(false);
    }
  }

  async function handleToggleBlock() {
    setShowMenu(false);
    try {
      if (isBlocked) {
        await unblockUser(counterpartId);
        setIsBlocked(false);
        setActionMessage("Unblocked.");
      } else {
        await blockUser(counterpartId);
        setIsBlocked(true);
        setActionMessage("Blocked — you won't see new messages from them here.");
      }
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Could not update block status.");
    }
  }

  async function handleReport(reason: "spam" | "inappropriate" | "false_info" | "harassment" | "hate_speech" | "other") {
    setShowReportPicker(false);
    try {
      await reportUserProfile({ userId: counterpartId, reason });
      setActionMessage("Report submitted.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Could not submit report.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[url('/bg.png')] bg-cover bg-center">
        <ScrollUnlock />
        <div className="pointer-events-none fixed inset-0 bg-black/60" />
        <div className="relative z-10 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[url('/bg.png')] bg-cover bg-center">
      <ScrollUnlock />
      <div className="pointer-events-none fixed inset-0 bg-black/60" />

      <div className="relative z-10 mx-auto flex h-screen w-full max-w-md flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 pb-4 pt-14">
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
            </svg>
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2">
            {counterpartAvatarUrl ? (
              <div className="relative h-8 w-8 flex-none overflow-hidden rounded-full">
                <Image src={counterpartAvatarUrl} alt="" fill className="object-cover" sizes="32px" unoptimized />
              </div>
            ) : (
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-red-900 text-[0.6rem] font-bold text-white">
                {(counterpartName ?? (isProducerOwnerReplying ? "CU" : "?")).slice(0, 2).toUpperCase()}
              </div>
            )}
            <h1 className="truncate text-[0.95rem] font-bold text-white">
              {counterpartName ?? (isProducerOwnerReplying ? "Customer" : "Conversation")}
            </h1>
          </div>

          <button
            type="button"
            aria-label="More options"
            onClick={() => setShowMenu((v) => !v)}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
        </div>

        {showMenu ? (
          <>
            <div
              className="fixed inset-0 z-20"
              aria-hidden="true"
              onClick={() => setShowMenu(false)}
            />
            <div
              ref={menuRef}
              className="absolute right-4 top-[4.2rem] z-30 w-48 overflow-hidden rounded-xl border border-white/10 bg-black/90 text-sm text-white shadow-xl"
            >
            <button
              type="button"
              onClick={handleToggleBlock}
              className="block w-full px-4 py-3 text-left hover:bg-white/10"
            >
              {isBlocked ? "Unblock" : "Block"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMenu(false);
                setShowReportPicker(true);
              }}
              className="block w-full px-4 py-3 text-left text-red-400 hover:bg-white/10"
            >
              Report
            </button>
            </div>
          </>
        ) : null}

        {showReportPicker ? (
          <div
            className="absolute inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center"
            onClick={() => setShowReportPicker(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#1a0a0a] p-4 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-3 text-sm font-semibold text-white">Why are you reporting this person?</p>
              <div className="flex flex-col gap-1">
                {(["spam", "inappropriate", "false_info", "harassment", "hate_speech", "other"] as const).map(
                  (reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => handleReport(reason)}
                      className="rounded-lg px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
                    >
                      {reason.replace("_", " ")}
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowReportPicker(false)}
                className="mt-2 w-full rounded-lg px-3 py-2 text-center text-sm text-white/50 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {actionMessage ? (
          <div className="border-b border-white/10 bg-white/5 px-4 py-2 text-center text-[0.75rem] text-white/70">
            {actionMessage}
          </div>
        ) : null}

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 space-y-2 overflow-y-auto px-4 py-4"
        >
          {loadingOlder ? (
            <div className="flex justify-center py-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-[0.85rem] text-white/40">No messages yet. Say hi!</p>
            </div>
          ) : (
            messages.map((message, i) => {
              const isMine = message.sender_id === account?.id;
              const prev = messages[i - 1];
              const showDay =
                !prev || !sameDay(toMs(prev.created_at), toMs(message.created_at));
              return (
                <Fragment key={message.id}>
                  {showDay ? (
                    <div className="flex justify-center py-2">
                      <span className="rounded-full bg-black/40 px-3 py-1 text-[0.62rem] font-medium text-white/50">
                        {dayLabel(toMs(message.created_at))}
                      </span>
                    </div>
                  ) : null}
                  <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[0.85rem] leading-snug ${
                        isMine ? "bg-red-600 text-white" : "bg-white/10 text-white/90"
                      } ${message.failed ? "ring-1 ring-red-400/60" : ""}`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.message_text}</p>
                      <p
                        className={`mt-1 flex items-center justify-end gap-1 text-[0.62rem] ${
                          isMine ? "text-white/70" : "text-white/40"
                        }`}
                      >
                        {message.failed ? (
                          <span className="text-red-300">
                            {message.blocked ? "Not delivered" : "Failed — tap Send to retry"}
                          </span>
                        ) : message.pending ? (
                          <span>Sending…</span>
                        ) : (
                          formatTime(message.created_at)
                        )}
                      </p>
                    </div>
                  </div>
                </Fragment>
              );
            })
          )}
        </div>

        {error ? (
          <p className="px-4 pb-2 text-center text-[0.78rem] text-red-400">{error}</p>
        ) : null}

        {/* Composer */}
        <div className="border-t border-white/10 px-4 py-3">
          {isBlocked ? (
            <p className="py-2 text-center text-[0.78rem] text-white/40">
              You&apos;ve blocked this person. Unblock to send messages.
            </p>
          ) : blockedByOther ? (
            <p className="py-2 text-center text-[0.78rem] text-white/40">
              You can&apos;t send messages to this person right now.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={composerRef}
                rows={1}
                value={composerText}
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(e) => {
                  setComposerText(e.target.value);
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Message"
                style={{ fontSize: "16px" }}
                className="min-w-0 flex-1 resize-none rounded-2xl border border-white/15 bg-black/25 px-4 py-2.5 text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !composerText.trim()}
                className="flex-none rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
