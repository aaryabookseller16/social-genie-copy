"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?screen=account&signup=vibee");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1a0505] via-[#2a0a0a] to-black px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-[#e83434]" />
        <h1 className="text-xl font-semibold text-white">
          Opening your V.I.Bee membership...
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Taking you to the signup form.
        </p>
      </div>
    </div>
  );
}
