"use client";

import { useEffect, useState } from "react";
import { ScrollUnlock } from "@/app/p/[id]/ScrollUnlock";
import {
  fetchOrCreateReferralCode,
  fetchReferralDashboard,
  type ReferralEntry,
} from "@/app/lib/publicApiClient";

type Props = {
  onBack: () => void;
};

function formatDate(value?: number | string): string {
  if (!value) return "";
  const ms = typeof value === "number" && value < 1_000_000_000_000 ? value * 1000 : value;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function ReferralRow({ entry }: { entry: ReferralEntry }) {
  const name = [entry.first_name, entry.last_name].filter(Boolean).join(" ") || "New user";
  const status = entry.verified ? "Verified" : "Pending verification";

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[0.85rem] font-semibold leading-snug text-gray-900 dark:text-white">
          {name}
        </p>
        <p className="mt-0.5 text-[0.78rem] leading-snug text-gray-600 dark:text-white/60">
          {entry.email_masked}
        </p>
        <p className="mt-1 text-[0.68rem] text-gray-400 dark:text-white/35">
          {formatDate(entry.created_at)} · {status}
          {entry.membership_active ? " · V.I.Bee" : ""}
        </p>
      </div>
    </div>
  );
}

export function ReferralScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const created = await fetchOrCreateReferralCode();
        if (cancelled) return;
        setCode(created.code);

        const dashboard = await fetchReferralDashboard();
        if (cancelled) return;
        setReferrals(dashboard.referrals ?? []);
      } catch {
        if (!cancelled) {
          setError("Could not load your referral code. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const referralUrl = code
    ? `${typeof window !== "undefined" ? window.location.origin : "https://socialgenie.app"}/join?ref=${code}`
    : "";

  function handleCopy() {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Referrals</h1>
          <div className="w-9" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-red-600 dark:border-white/20 dark:border-t-white" />
          </div>
        ) : error ? (
          <div className="px-4 py-10 text-center text-[0.85rem] text-gray-500 dark:text-white/50">
            {error}
          </div>
        ) : (
          <>
            {/* Referral link card */}
            <div className="mx-4 mt-4 rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-[0.75rem] font-medium uppercase tracking-wide text-gray-500 dark:text-white/40">
                Your referral link
              </p>
              <p className="mt-2 break-all text-[0.9rem] font-semibold text-gray-900 dark:text-white">
                {referralUrl}
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-3 w-full rounded-xl bg-red-600 px-4 py-2 text-[0.85rem] font-semibold text-white transition hover:bg-red-700"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>

            {/* Referral count */}
            <div className="mx-4 mt-4 flex items-center justify-between">
              <p className="text-[0.85rem] font-semibold text-gray-900 dark:text-white">
                People you referred
              </p>
              <span className="text-[0.85rem] font-semibold text-gray-500 dark:text-white/50">
                {referrals.length}
              </span>
            </div>

            {/* Referral list */}
            {referrals.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <p className="text-[0.9rem] text-gray-400 dark:text-white/40">
                  No one has signed up with your link yet.
                </p>
              </div>
            ) : (
              <div className="mt-2 divide-y divide-gray-200 dark:divide-white/[0.08]">
                {referrals.map((entry, index) => (
                  <ReferralRow key={index} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
