"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ScrollUnlock } from "@/app/p/[id]/ScrollUnlock";
import {
  blockUser,
  fetchBlockedUsers,
  fetchMessageThreads,
  fetchThreadMessages,
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
  const [messages, setMessages] = useState<RawMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportPicker, setShowReportPicker] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

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
    (isInitial: boolean) => {
      if (threadId === null) return;
      if (isInitial) setLoading(true);
      fetchThreadMessages(threadType, threadId)
        .then((raw) => setMessages(raw.messages ?? []))
        .catch(() => {
          if (isInitial) setError("This conversation could not be loaded.");
        })
        .finally(() => {
          if (isInitial) setLoading(false);
        });
    },
    [threadId, threadType]
  );

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
    loadMessages(true);
    const interval = setInterval(() => loadMessages(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [threadId, loadMessages]);

  useEffect(() => {
    fetchBlockedUsers()
      .then((r) => {
        setIsBlocked((r.blocked_user_ids ?? []).includes(counterpartId));
      })
      .catch(() => {});
  }, [counterpartId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = composerText.trim();
    if (!text || sending) return;
    if (isProducerOwnerReplying && threadId === null) return; // no thread to reply in
    setSending(true);
    setError(null);
    try {
      const result = isProducerOwnerReplying
        ? await replyAsProducer(threadId as number, text)
        : await sendMessage({
            recipientId: counterpartId,
            recipientType: threadType,
            text,
          });
      setComposerText("");
      if (result.message) {
        setMessages((prev) => [...prev, result.message]);
      }
      if (threadId === null && result.thread_id) {
        onThreadCreated(result.thread_id, viewerRole);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
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
          <div className="absolute right-4 top-[4.2rem] z-20 w-48 overflow-hidden rounded-xl border border-white/10 bg-black/90 text-sm text-white shadow-xl">
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
        ) : null}

        {showReportPicker ? (
          <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center">
            <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#1a0a0a] p-4 sm:rounded-2xl">
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
        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-[0.85rem] text-white/40">No messages yet. Say hi!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.sender_id === account?.id;
              return (
                <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[0.85rem] leading-snug ${
                      isMine
                        ? "bg-red-600 text-white"
                        : "bg-white/10 text-white/90"
                    }`}
                  >
                    <p>{message.message_text}</p>
                    <p className={`mt-1 text-[0.62rem] ${isMine ? "text-white/70" : "text-white/40"}`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={listEndRef} />
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
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder="Message"
                style={{ fontSize: "16px" }}
                className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/25 px-4 py-2.5 text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none"
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
