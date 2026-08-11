"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markMatchingNotificationsRead } from "@/app/lib/publicApiClient";

/**
 * Landing target for "new event" push notifications. The backend hard-codes
 * each push's URL to `/events?event_id={id}`, but the app itself is a
 * single-page shell at `/`. This route reads the event id from the query and
 * forwards into the app's internal deep-link scheme, which opens the event
 * detail screen. Reading `window.location.search` directly avoids needing a
 * Suspense boundary for `useSearchParams`.
 */
export default function EventsRedirect() {
  const router = useRouter();

  useEffect(() => {
    const eventId = new URLSearchParams(window.location.search).get(
      "event_id"
    );
    if (eventId && Number.isFinite(Number(eventId))) {
      const eid = Number(eventId);
      markMatchingNotificationsRead(
        (n) => n.entityType === "event" && n.eventId === eid
      ).catch(() => {});
      router.replace(`/?screen=event&event_id=${eid}`);
    } else {
      router.replace("/");
    }
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat dark:bg-[url('/bg.png')]">
      <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/60 dark:block" />
      <div className="relative z-10 h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-red-600 dark:border-white/20 dark:border-t-white" />
    </main>
  );
}
