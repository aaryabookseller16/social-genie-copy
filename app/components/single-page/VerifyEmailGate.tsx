"use client";

import { useState } from "react";

import { trackEvent } from "@/app/lib/analytics";
import { analyticsEvents } from "@/app/lib/analyticsEvents";
import { signUpUser } from "@/app/lib/publicApiClient";
import { ActionButton } from "./ui";

export function VerifyEmailGate({
  visible,
  email,
  onClose,
}: {
  visible: boolean;
  email: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  if (!visible) {
    return null;
  }

  const resend = async () => {
    if (!email || isResending) {
      return;
    }
    setIsResending(true);
    setMessage(null);
    trackEvent(analyticsEvents.verifyEmailResendTapped, { email });
    try {
      const result = await signUpUser({ email });
      setMessage(
        result.message || "We sent a fresh magic link — check your inbox."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not resend your link right now."
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-6 pt-10 sm:items-center">
      <div className="w-full max-w-md rounded-[24px] border border-gray-200 bg-white p-6 shadow-xl dark:border-white/15 dark:bg-[#1a0d0d]">
        <h2 className="text-[1.4rem] font-semibold leading-tight text-gray-900 dark:text-white">
          Verify your email to keep going
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-700 dark:text-white/70">
          Tap the magic link we sent
          {email ? <> to <span className="font-semibold">{email}</span></> : null}{" "}
          to unlock Genie. It only takes a second.
        </p>

        {message ? (
          <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
            {message}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          <ActionButton
            className="w-full"
            onClick={() => void resend()}
            disabled={isResending}
          >
            {isResending ? "Sending..." : "Resend link"}
          </ActionButton>
          <ActionButton variant="secondary" className="w-full" onClick={onClose}>
            Not now
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
