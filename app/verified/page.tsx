"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function VerifiedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token");
    router.replace(token ? `/?token=${encodeURIComponent(token)}` : "/");
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1a0505] via-[#2a0a0a] to-black px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-[#e83434]" />
        <h1 className="text-xl font-semibold text-white">
          Redirecting to Genie...
        </h1>
        <p className="mt-2 text-sm text-white/50">
          We are taking you back to the app to finish sign-in.
        </p>
      </div>
    </div>
  );
}

export default function VerifiedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1a0505] via-[#2a0a0a] to-black px-6">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-[#e83434]" />
        </div>
      }
    >
      <VerifiedContent />
    </Suspense>
  );
}
