"use client";

import { useEffect, useState } from "react";
import { ScrollUnlock } from "@/app/p/[id]/ScrollUnlock";
import {
  ApiError,
  createConnectOnboardingLink,
  fetchConnectStatus,
  fetchOrCreateReferralCode,
  fetchReferralDashboard,
  requestReferralWithdraw,
  type ReferralEntry,
} from "@/app/lib/publicApiClient";

const MIN_WITHDRAWAL = 5;

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
  const initial = (entry.first_name || entry.email_masked || "?").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-600/10 text-[0.9rem] font-bold text-red-600 dark:bg-white/10 dark:text-white">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.85rem] font-semibold leading-snug text-gray-900 dark:text-white">
          {name}
        </p>
        <p className="mt-0.5 truncate text-[0.78rem] leading-snug text-gray-600 dark:text-white/60">
          {entry.email_masked}
        </p>
        <p className="mt-1 text-[0.68rem] text-gray-400 dark:text-white/35">
          {formatDate(entry.created_at)}
        </p>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        {entry.membership_active ? (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[0.65rem] font-semibold text-white">
            V.I.Bee
          </span>
        ) : null}
        <span
          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
            entry.verified
              ? "bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400"
              : "bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-white/50"
          }`}
        >
          {entry.verified ? "Verified" : "Pending"}
        </span>
      </div>
    </div>
  );
}

function formatDollars(value: number): string {
  return `$${value.toFixed(2)}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-[0.68rem] font-medium uppercase tracking-wide text-gray-500 dark:text-white/40">
        {label}
      </p>
      <p className="mt-1 text-[1.1rem] font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

const CODE_LENGTH = 8;

function isValidCode(value: string): boolean {
  return new RegExp(`^[A-Z0-9]{${CODE_LENGTH}}$`).test(value);
}

export function ReferralScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [earnings, setEarnings] = useState({
    pending_amount: 0,
    available_amount: 0,
    total_earned: 0,
  });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  // Onboarding (no code yet) state
  const [customCode, setCustomCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const dashboard = await fetchReferralDashboard();
        if (cancelled) return;
        if (dashboard.code) {
          setCode(dashboard.code);
          setReferrals(dashboard.referrals ?? []);
          setEarnings({
            pending_amount: dashboard.pending_amount ?? 0,
            available_amount: dashboard.available_amount ?? 0,
            total_earned: dashboard.total_earned ?? 0,
          });
          try {
            const status = await fetchConnectStatus();
            if (!cancelled) setPayoutsEnabled(status.payouts_enabled);
          } catch {
            // Non-fatal — button falls back to "set up payout account" flow.
          }
        }
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

  async function claimCode(desiredCode?: string) {
    setClaiming(true);
    setClaimError(null);
    try {
      const created = await fetchOrCreateReferralCode(desiredCode);
      setCode(created.code);
      const dashboard = await fetchReferralDashboard();
      setReferrals(dashboard.referrals ?? []);
      setEarnings({
        pending_amount: dashboard.pending_amount ?? 0,
        available_amount: dashboard.available_amount ?? 0,
        total_earned: dashboard.total_earned ?? 0,
      });
    } catch (err) {
      setClaimError(
        err instanceof ApiError ? err.message : "Could not set your referral code. Please try again."
      );
    } finally {
      setClaiming(false);
    }
  }

  function handleCustomCodeSubmit() {
    const value = customCode.trim().toUpperCase();
    if (!isValidCode(value)) {
      setClaimError(`Code must be exactly ${CODE_LENGTH} letters/numbers.`);
      return;
    }
    void claimCode(value);
  }

  const referralStats = {
    totalReferrals: referrals.length,
    vibeeMembers: referrals.filter((r) => r.membership_active).length,
    earned: earnings.total_earned,
    pending: earnings.pending_amount,
    withdrawable: earnings.available_amount,
  };

  const referralUrl = code
    ? `${typeof window !== "undefined" ? window.location.origin : "https://socialgenie.app"}/join?ref=${code}`
    : "";

  async function handleWithdraw() {
    setWithdrawing(true);
    setWithdrawError(null);
    setWithdrawMessage(null);
    try {
      if (!payoutsEnabled) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const returnUrl = `${origin}/?screen=referrals`;
        const { url } = await createConnectOnboardingLink(returnUrl, returnUrl);
        window.location.href = url;
        return;
      }

      const result = await requestReferralWithdraw();
      setWithdrawMessage(`$${result.amount.toFixed(2)} is on its way to your bank.`);
      const dashboard = await fetchReferralDashboard();
      setEarnings({
        pending_amount: dashboard.pending_amount ?? 0,
        available_amount: dashboard.available_amount ?? 0,
        total_earned: dashboard.total_earned ?? 0,
      });
    } catch (err) {
      setWithdrawError(
        err instanceof ApiError ? err.message : "Could not process your withdrawal. Please try again."
      );
    } finally {
      setWithdrawing(false);
    }
  }

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
        ) : !code ? (
          <div className="mx-4 mt-6">
            <p className="text-[0.9rem] font-semibold text-gray-900 dark:text-white">
              Set up your referral code
            </p>
            <p className="mt-1 text-[0.8rem] text-gray-500 dark:text-white/50">
              Pick your own {CODE_LENGTH}-character code, or generate one automatically.
            </p>

            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase().slice(0, CODE_LENGTH))}
              placeholder="YOURCODE"
              maxLength={CODE_LENGTH}
              disabled={claiming}
              className="mt-4 w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-[0.9rem] font-semibold uppercase tracking-wide text-gray-900 outline-none focus:border-red-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />

            {claimError && (
              <p className="mt-2 text-[0.78rem] text-red-600 dark:text-red-400">{claimError}</p>
            )}

            <button
              type="button"
              onClick={handleCustomCodeSubmit}
              disabled={claiming || customCode.length === 0}
              className="mt-3 w-full rounded-xl bg-red-600 px-4 py-2 text-[0.85rem] font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {claiming ? "Setting up…" : "Set my code"}
            </button>

            <button
              type="button"
              onClick={() => claimCode()}
              disabled={claiming}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-[0.85rem] font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
            >
              Auto-generate
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
              <StatCard label="Total referrals" value={String(referralStats.totalReferrals)} />
              <StatCard label="V.I.Bee members" value={String(referralStats.vibeeMembers)} />
              <StatCard label="Total earned" value={formatDollars(referralStats.earned)} />
              <StatCard label="Pending" value={formatDollars(referralStats.pending)} />
            </div>
            <div className="mx-4 mt-3 rounded-2xl border border-gray-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-[0.68rem] font-medium uppercase tracking-wide text-gray-500 dark:text-white/40">
                Available to withdraw
              </p>
              <p className="mt-1 text-[1.1rem] font-bold text-gray-900 dark:text-white">
                {formatDollars(referralStats.withdrawable)}
              </p>
              {withdrawMessage && (
                <p className="mt-3 text-[0.78rem] text-green-600 dark:text-green-400">{withdrawMessage}</p>
              )}
              {withdrawError && (
                <p className="mt-3 text-[0.78rem] text-red-600 dark:text-red-400">{withdrawError}</p>
              )}
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={
                  withdrawing || (payoutsEnabled && referralStats.withdrawable < MIN_WITHDRAWAL)
                }
                className="mt-3 w-full rounded-xl bg-red-600 px-4 py-2 text-[0.85rem] font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {withdrawing
                  ? "Working…"
                  : !payoutsEnabled
                    ? "Set up payout account"
                    : referralStats.withdrawable < MIN_WITHDRAWAL
                      ? `Minimum withdrawal $${MIN_WITHDRAWAL.toFixed(2)}`
                      : "Request payout"}
              </button>
            </div>

            {/* Referral link card */}
            <div className="mx-4 mt-3 rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
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
            <div className="mx-4 mt-5 flex items-center justify-between">
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
              <div className="mx-4 mt-2 flex flex-col gap-2 pb-6">
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
