"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function VendorSuccessContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? null;

  const planLabel = (() => {
    switch (plan) {
      case "founding_partner":
        return "Founding Partner";
      // `plan` carries plan_type, not the tier — checkout sends "boost" for all
      // four one-time durations. The tier-suffixed values are legacy.
      case "boost":
      case "boost_1999":
      case "boost_3999":
      case "boost_5999":
        return "Boost";
      case "monthly_boost":
        return "Monthly Boost";
      default:
        return null;
    }
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat dark:bg-[linear-gradient(180deg,#1a0505,#2a0a0a,#000)] px-6 py-10">
      <div className="w-full max-w-md rounded-[28px] border border-gray-100 bg-white/90 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black/40 dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)] dark:backdrop-blur-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
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
        <h1 className="font-[family:var(--font-display)] text-2xl font-semibold text-gray-900 dark:text-white">
          {planLabel ? `${planLabel} activated!` : "Vendor plan activated!"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-white/70">
          Your business is now live on Genie. Head to your dashboard to add
          offers, update your profile, and track performance.
        </p>

        <ul className="mt-6 space-y-2 text-left text-sm text-gray-600 dark:text-white/72">
          <li className="flex items-start gap-2">
            <span className="mt-1 text-green-600 dark:text-green-400">✓</span>
            Your venue is visible in Genie results
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-green-600 dark:text-green-400">✓</span>
            Create V.I.Bee member offers
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-green-600 dark:text-green-400">✓</span>
            Track redemptions and analytics
          </li>
        </ul>

        <Link
          href="/?screen=dashboard"
          className="mt-8 inline-flex w-full items-center justify-center rounded-[18px] border border-red-500 bg-red-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-red-700 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
        >
          Open Vendor Dashboard
        </Link>
        <Link
          href="/"
          className="mt-3 inline-block text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
        >
          Back to Genie
        </Link>
      </div>
    </div>
  );
}

export default function VendorSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat dark:bg-[linear-gradient(180deg,#1a0505,#2a0a0a,#000)]">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[#e83434] dark:border-white/15" />
        </div>
      }
    >
      <VendorSuccessContent />
    </Suspense>
  );
}
