"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ScrollUnlock } from "@/app/p/[id]/ScrollUnlock";
import {
  fetchMessageThreads,
  fetchProducerPublicProfile,
  fetchUserBasicProfile,
  mergeThreadsToConversations,
  type Conversation,
  type MessageThreadType,
} from "@/app/lib/publicApiClient";
import { type ConsumerAccount } from "@/app/lib/localState";

type OpenConversationInput = {
  threadId: number;
  threadType: MessageThreadType;
  counterpartId: number;
  counterpartName?: string;
  counterpartAvatarUrl?: string;
  viewerRole?: "consumer" | "producer";
};

type Props = {
  account: ConsumerAccount | null;
  onBack: () => void;
  onOpenConversation: (conv: OpenConversationInput) => void;
};

function timeAgo(epochMs: number): string {
  if (!epochMs) return "";
  const seconds = Math.floor((Date.now() - epochMs) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ConversationAvatar({ conversation }: { conversation: Conversation }) {
  if (conversation.counterpartAvatarUrl) {
    return (
      <div className="relative h-12 w-12 flex-none overflow-hidden rounded-full">
        <Image
          src={conversation.counterpartAvatarUrl}
          alt=""
          fill
          className="object-cover"
          sizes="48px"
          unoptimized
        />
      </div>
    );
  }
  const initials = (
    conversation.counterpartName ?? (conversation.viewerRole === "producer" ? "CU" : "?")
  )
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-red-900 text-[0.7rem] font-bold text-white">
      {initials}
    </div>
  );
}

export function MessagesScreen({ account, onBack, onOpenConversation }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const raw = await fetchMessageThreads("all");
      const merged = mergeThreadsToConversations(raw, account?.id);
      setConversations(merged);

      // The threads list doesn't include the producer's display name/photo —
      // look those up separately for producer conversations so the inbox
      // doesn't just show "Conversation" for every business thread.
      // Only enrich when *we're* the consumer looking at a producer —
      // if we're the producer owner, counterpartId is the consumer's user
      // id, not a producer id, so this lookup would be meaningless.
      const producerIds = Array.from(
        new Set(
          merged
            .filter(
              (c) =>
                c.threadType === "producer" &&
                c.viewerRole !== "producer" &&
                !c.counterpartName
            )
            .map((c) => c.counterpartId)
        )
      );

      // Symmetric case: we're the producer owner looking at a customer's
      // thread. The threads list never includes the customer's name either
      // — it only gives us their raw user id — so it falls back to a
      // generic "Customer" placeholder unless we look it up here.
      const customerIds = Array.from(
        new Set(
          merged
            .filter(
              (c) =>
                c.threadType === "producer" &&
                c.viewerRole === "producer" &&
                !c.counterpartName
            )
            .map((c) => c.counterpartId)
        )
      );

      if (producerIds.length === 0 && customerIds.length === 0) return;

      const [producerProfiles, customerProfiles] = await Promise.all([
        Promise.all(producerIds.map((id) => fetchProducerPublicProfile(id).catch(() => null))),
        Promise.all(customerIds.map((id) => fetchUserBasicProfile(id).catch(() => null))),
      ]);

      // Two separate maps: producer_id and user_id are different id spaces
      // and can collide numerically, so they must never share one lookup.
      const producerNameById = new Map<number, { name?: string; avatar?: string }>();
      producerProfiles.forEach((p, i) => {
        if (p?.producer) {
          producerNameById.set(producerIds[i], {
            name: p.producer.display_name,
            avatar: p.producer.profile_photo_url,
          });
        }
      });

      const customerNameById = new Map<number, { name?: string; avatar?: string }>();
      customerProfiles.forEach((p, i) => {
        if (p?.display_name) {
          customerNameById.set(customerIds[i], {
            name: p.display_name,
            avatar: p.avatar_url,
          });
        }
      });

      setConversations((prev) =>
        prev.map((c) => {
          if (c.threadType !== "producer") return c;
          const info =
            c.viewerRole === "producer"
              ? customerNameById.get(c.counterpartId)
              : producerNameById.get(c.counterpartId);
          if (!info) return c;
          return {
            ...c,
            counterpartName: c.counterpartName ?? info.name,
            counterpartAvatarUrl: c.counterpartAvatarUrl ?? info.avatar,
          };
        })
      );
    } catch {
      // Keep whatever's already on screen; a failed refresh shouldn't blank it.
    }
  }, [account?.id]);

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
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
    <main className="min-h-screen bg-[url('/bg.png')] bg-cover bg-center">
      <ScrollUnlock />
      <div className="pointer-events-none fixed inset-0 bg-black/60" />

      <div className="relative z-10 mx-auto max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 pb-4 pt-14">
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-white">Messages</h1>
          <button
            type="button"
            aria-label="Refresh"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10 disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>

        {/* List */}
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <svg viewBox="0 0 24 24" className="mb-4 h-10 w-10 text-white/20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <p className="text-[0.9rem] text-white/40">No conversations yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.08]">
            {conversations.map((conversation) => (
              <button
                key={`${conversation.threadType}-${conversation.threadId}`}
                type="button"
                onClick={() =>
                  onOpenConversation({
                    threadId: conversation.threadId,
                    threadType: conversation.threadType,
                    counterpartId: conversation.counterpartId,
                    counterpartName: conversation.counterpartName,
                    counterpartAvatarUrl: conversation.counterpartAvatarUrl,
                    viewerRole: conversation.viewerRole,
                  })
                }
                className={`flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/5 ${
                  conversation.unreadCount > 0 ? "bg-white/5" : "bg-transparent"
                }`}
              >
                <ConversationAvatar conversation={conversation} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9rem] font-semibold leading-snug text-white">
                    {conversation.counterpartName ??
                      (conversation.viewerRole === "producer" ? "Customer" : "Conversation")}
                  </p>
                  <p className="mt-0.5 truncate text-[0.78rem] leading-snug text-white/60">
                    {conversation.lastMessagePreview || "Start the conversation"}
                  </p>
                </div>

                <div className="flex flex-none flex-col items-end gap-1">
                  <p className="text-[0.68rem] text-white/35">{timeAgo(conversation.lastMessageAt)}</p>
                  {conversation.unreadCount > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold leading-none text-white">
                      {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
