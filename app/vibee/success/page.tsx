"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { fetchSubscriptionStatusForSession } from "@/app/lib/publicApiClient";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"pending" | "active" | "unknown">(
    "pending"
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setStatus("unknown");
      setMessage(
        "We couldn't detect a Stripe session. If your payment went through, your membership will activate shortly."
      );
      return;
    }

    (async () => {
      try {
        const res = await fetchSubscriptionStatusForSession(sessionId);
        if (cancelled) return;
        if (res.status === "active") {
          setStatus("active");
        } else {
          // Webhook may lag by a few seconds — surface a friendly pending state.
          setStatus("unknown");
          setMessage(
            "We received your payment. Your V.I.Bee membership is activating — refresh in a moment."
          );
        }
      } catch {
        if (cancelled) return;
        setStatus("unknown");
        setMessage(
          "Your payment is processing. If this takes more than a minute, contact support."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#1a0505,#2a0a0a,#000)] px-6 py-10">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-black/40 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        {status === "pending" ? (
          <>
            <div className="mx-auto mb-6 h-14 w-14 animate-spin rounded-full border-4 border-white/15 border-t-[#e83434]" />
            <h1 className="font-[family:var(--font-display)] text-2xl font-semibold text-white">
              Activating your V.I.Bee membership...
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Confirming your payment with Stripe.
            </p>
          </>
        ) : status === "active" ? (
          <>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-green-400">
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="font-[family:var(--font-display)] text-2xl font-semibold text-white">
              Welcome to V.I.Bee!
            </h1>
            <p className="mt-3 text-sm text-white/70">
              Your membership is active. Unlock exclusive offers, early
              invites, and members-only deals across every venue.
            </p>
            <Link
              href="/?screen=offers"
              className="mt-8 inline-flex w-full items-center justify-center rounded-[18px] border border-red-500 bg-red-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-red-700 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
            >
              See V.I.Bee Offers
            </Link>
            <Link
              href="/"
              className="mt-3 inline-block text-sm font-medium text-white/60 hover:text-white"
            >
              Back to Genie
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h0" />
              </svg>
            </div>
            <h1 className="font-[family:var(--font-display)] text-2xl font-semibold text-white">
              Payment received
            </h1>
            <p className="mt-3 text-sm text-white/70">
              {message ?? "Your membership is being activated."}
            </p>
            <Link
              href="/"
              className="mt-8 inline-flex w-full items-center justify-center rounded-[18px] border border-red-500 bg-red-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-red-700 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
            >
              Back to Genie
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VibeeSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#1a0505,#2a0a0a,#000)]">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-[#e83434]" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
