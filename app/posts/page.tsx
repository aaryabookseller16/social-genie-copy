"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markMatchingNotificationsRead } from "@/app/lib/publicApiClient";

/**
 * Landing target for "new post" push notifications. The backend hard-codes
 * each push's URL to `/posts?post_id={id}`, but posts are viewed at
 * `/posts/{id}`. This route reads the post id from the query and forwards to
 * the real post route. Reading `window.location.search` directly avoids
 * needing a Suspense boundary for `useSearchParams`.
 */
export default function PostsRedirect() {
  const router = useRouter();

  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get(
      "post_id"
    );
    if (postId && Number.isFinite(Number(postId))) {
      const pid = Number(postId);
      markMatchingNotificationsRead(
        (n) => n.entityType === "post" && n.postId === pid
      ).catch(() => {});
      router.replace(`/posts/${pid}`);
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
