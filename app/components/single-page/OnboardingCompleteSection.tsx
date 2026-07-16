"use client";

import { type RefObject, useEffect } from "react";

import { trackEvent } from "@/app/lib/analytics";
import { analyticsEvents } from "@/app/lib/analyticsEvents";
import { writeOnboardingPending, readAuthToken } from "@/app/lib/localState";
import { ActionButton } from "./ui";

export function OnboardingCompleteSection({
  sectionRef,
  visible,
  email,
  onOpenGenie,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  visible: boolean;
  email: string;
  onOpenGenie: () => void;
}) {
  // Record the pending-verification state when the user lands here so the
  // verification gate can engage on the next gated action / session.
  useEffect(() => {
    if (!visible) {
      return;
    }
    // Only write pending state for new users who haven't verified yet.
    // Skip if already logged in (e.g. a returning verified user re-ran the wizard).
    if (email && !readAuthToken()) {
      writeOnboardingPending({
        email,
        completedAt: Date.now(),
        verified: false,
      });
    }
    trackEvent(analyticsEvents.onboardingCompleted, { email });
  }, [visible, email]);

  if (!visible) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[calc(100dvh-1.5rem)] flex-col items-center justify-center overflow-hidden bg-transparent px-4 pb-6 pt-10 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500 text-red-600 dark:border-[#ff7b7b] dark:text-[#ff7b7b]">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 12.5 4 4 10-10" />
        </svg>
      </div>

      <h2 className="mt-6 text-[1.85rem] font-semibold leading-tight text-gray-900 dark:text-white">
        You&apos;re all set!
      </h2>
      <p className="mx-auto mt-3 max-w-[30ch] text-[15px] leading-relaxed text-gray-700 dark:text-white/70">
        Check your email to verify your account
        {email ? <> at <span className="font-semibold">{email}</span></> : null}
        , then come meet Genie.
      </p>

      <div className="mt-10 w-full max-w-[22rem]">
        <ActionButton className="w-full" onClick={onOpenGenie}>
          Open Genie
        </ActionButton>
      </div>
    </section>
  );
}
