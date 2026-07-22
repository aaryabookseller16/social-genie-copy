"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ScrollUnlock } from "@/app/p/[id]/ScrollUnlock";
import {
  fetchUserNotifications,
  markNotificationsRead,
  type UserNotification,
} from "@/app/lib/publicApiClient";

type Props = {
  onBack: () => void;
  onClearUnread: () => void;
};

function timeAgo(unixTimestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - unixTimestamp);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function NotifAvatar({ notification }: { notification: UserNotification }) {
  if (notification.actor_image_url) {
    return (
      <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full">
        <Image
          src={notification.actor_image_url}
          alt={notification.actor_name ?? ""}
          fill
          className="object-cover"
          sizes="40px"
          unoptimized
        />
      </div>
    );
  }
  const initials = (notification.actor_name ?? notification.type)
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-red-900 text-[0.6rem] font-bold text-white">
      {initials}
    </div>
  );
}

export function NotificationsScreen({ onBack, onClearUnread }: Props) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserNotifications()
      .then((r) => {
        setNotifications(r.notifications ?? []);
        onClearUnread();
      })
      .catch(() => {
        setNotifications([]);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMarkAll() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    if (unreadIds.length > 0) {
      markNotificationsRead(unreadIds).catch(() => {});
    }
  }

  function handleRowTap(notification: UserNotification) {
    if (!notification.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      markNotificationsRead([notification.id]).catch(() => {});
    }
    if (notification.target_url) {
      window.location.href = notification.target_url;
    }
  }

  const hasUnread = notifications.some((n) => !n.is_read);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat dark:bg-[url('/bg.png')]">
        <ScrollUnlock />
        <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/60 dark:block" />
        <div className="relative z-10 h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-red-600 dark:border-white/20 dark:border-t-white" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat dark:bg-[url('/bg.png')]">
      <ScrollUnlock />
      <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/60 dark:block" />

      <div className="relative z-10 mx-auto max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 pb-4 pt-14 dark:border-white/10">
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
            </svg>
          </button>

          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h1>

          {hasUnread ? (
            <button
              type="button"
              onClick={handleMarkAll}
              className="text-[0.75rem] font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Mark all ✓
            </button>
          ) : (
            <div className="w-16" />
          )}
        </div>

        {/* List */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <svg viewBox="0 0 24 24" className="mb-4 h-10 w-10 text-gray-300 dark:text-white/20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-[0.9rem] text-gray-400 dark:text-white/40">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-white/[0.08]">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleRowTap(notification)}
                className={`flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-gray-50 dark:hover:bg-white/5 ${
                  notification.is_read
                    ? "bg-transparent"
                    : "bg-red-50/70 dark:bg-white/5"
                }`}
              >
                <NotifAvatar notification={notification} />

                <div className="min-w-0 flex-1">
                  <p className="text-[0.85rem] font-semibold leading-snug text-gray-900 dark:text-white">
                    {notification.title}
                  </p>
                  <p className="mt-0.5 text-[0.78rem] leading-snug text-gray-600 dark:text-white/60">
                    {notification.body}
                  </p>
                  <p className="mt-1 text-[0.68rem] text-gray-400 dark:text-white/35">
                    {timeAgo(notification.created_at)}
                  </p>
                </div>

                {!notification.is_read && (
                  <div className="mt-1.5 h-2 w-2 flex-none rounded-full bg-red-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
