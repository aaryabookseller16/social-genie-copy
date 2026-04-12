"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

// Shape matches genie_api_reference.md §5.3
type VerificationPayload = {
  valid?: boolean;
  offer_title?: string;
  redeemed_at?: number;
  verified_at?: number;
  member_name?: string;
  vendor_id?: number;
  error?: string;
};

function formatTimestamp(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return "Unknown time";
  }

  const timestamp = value < 1_000_000_000_000 ? value * 1000 : value;
  return new Date(timestamp).toLocaleString();
}

export default function VerifyRedemptionPage() {
  const params = useParams<{ token?: string | string[] }>();
  const token = useMemo(() => {
    const value = params?.token;
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }
    return value ?? "";
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationPayload | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setError("Invalid code");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/genie/verify-redemption/${encodeURIComponent(token)}`,
          {
            cache: "no-store",
          }
        );

        const payload = (await response.json().catch(() => ({}))) as VerificationPayload;
        if (!response.ok || payload.valid !== true) {
          const message =
            typeof payload.error === "string" && payload.error.trim().length > 0
              ? payload.error
              : "Invalid code";
          if (!cancelled) {
            setError(message);
            setVerification(null);
          }
          return;
        }

        if (!cancelled) {
          setVerification(payload);
        }
      } catch {
        if (!cancelled) {
          setError("Invalid code");
          setVerification(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Docs §5.3: detect already-verified by comparing timestamps.
  // A fresh verification has verified_at set by this request (≠ redeemed_at).
  // A repeat scan has verified_at already set from the first scan.
  // Both redeemed_at and verified_at are present on valid responses; when they
  // differ it means staff is scanning a code that was already verified before.
  const alreadyVerified = Boolean(
    verification?.verified_at &&
      verification?.redeemed_at &&
      verification.verified_at !== verification.redeemed_at
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fff7f7,#ffeaea)] px-4 py-8 dark:bg-[linear-gradient(180deg,#150202,#2d0707)]">
      <div className="w-full max-w-md rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_16px_48px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black/24">
        {loading ? (
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-red-200 border-t-red-600 dark:border-[#6f1d1d] dark:border-t-[#ff7b7b]" />
            <p className="mt-4 text-sm text-gray-600 dark:text-white/72">
              Verifying redemption...
            </p>
          </div>
        ) : error || !verification ? (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-600 dark:bg-[#3a1111] dark:text-[#ff9696]">
              X
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-red-700 dark:text-[#ff8d8d]">
              Invalid Code
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-white/72">
              {error || "This redemption token is not valid."}
            </p>
          </div>
        ) : alreadyVerified ? (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700 dark:bg-[#10233e] dark:text-[#8ec5ff]">
              i
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-blue-700 dark:text-[#8ec5ff]">
              Already Verified
            </h1>
            <p className="mt-3 text-sm text-gray-700 dark:text-white/82">
              Offer: {verification.offer_title || "Offer"}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-white/72">
              Member: {verification.member_name || "Unknown member"}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-white/60">
              Verified at {formatTimestamp(verification.verified_at)}
            </p>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-700 dark:bg-[#13361c] dark:text-[#a8f5bc]">
              ✓
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-green-700 dark:text-[#a8f5bc]">
              Valid Redemption
            </h1>
            <p className="mt-3 text-sm text-gray-700 dark:text-white/82">
              Offer: {verification.offer_title || "Offer"}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-white/72">
              Member: {verification.member_name || "Unknown member"}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-white/60">
              Redeemed at {formatTimestamp(verification.redeemed_at)}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
