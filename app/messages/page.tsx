"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Landing target for DM push notifications. The backend hard-codes each push's
 * URL to `/messages?thread_id={id}`, but the app itself is a single-page shell
 * at `/`. This route reads the thread id from the query and forwards into the
 * app's internal deep-link scheme, which opens the conversation (loading
 * history and clearing unread). Reading `window.location.search` directly
 * avoids needing a Suspense boundary for `useSearchParams`.
 */
export default function MessagesRedirect() {
  const router = useRouter();

  useEffect(() => {
    const threadId = new URLSearchParams(window.location.search).get(
      "thread_id"
    );
    if (threadId && Number.isFinite(Number(threadId))) {
      router.replace(
        `/?screen=conversation&thread_type=user&thread_id=${Number(threadId)}`
      );
    } else {
      router.replace("/?screen=messages");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[url('/bg.png')] bg-cover bg-center">
      <div className="pointer-events-none fixed inset-0 bg-black/60" />
      <div className="relative z-10 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </main>
  );
}
