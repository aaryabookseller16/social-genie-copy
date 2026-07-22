"use client";

import { type RefObject, useState } from "react";

import { trackEvent } from "@/app/lib/analytics";
import { analyticsEvents } from "@/app/lib/analyticsEvents";
import { type RuntimeConfig } from "@/app/lib/genieTypes";
import { createSubscriptionCheckout } from "@/app/lib/publicApiClient";
import { PlanCards } from "./ui";

/**
 * Post-verification plan chooser — the only place a tier is committed.
 *
 * Reached after a magic link with `flow: "signup"` is exchanged, so the account
 * is already verified by the time V.I.Bee sends anyone to Stripe. (The old flow
 * charged before verification, which meant a mistyped email could pay for an
 * account it could never sign into.)
 */
export function PlanChoiceSection({
  sectionRef,
  visible,
  config,
  email,
  onChooseFree,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  visible: boolean;
  config: RuntimeConfig;
  email: string;
  onChooseFree: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!visible) {
    return null;
  }

  const chooseVibee = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage("Redirecting to secure checkout...");
    trackEvent(analyticsEvents.vibeeCtaTapped, { email });
    trackEvent(analyticsEvents.vibeeCheckoutStarted, { email });

    try {
      const { checkout_url } = await createSubscriptionCheckout({
        email,
        // `onboarding=1` tells the checkout-return handler to resume the
        // wizard at preferences rather than dropping the user on home.
        success_url: `${window.location.origin}?checkout=success&onboarding=1`,
        cancel_url: `${window.location.origin}?checkout=cancel`,
      });
      window.location.href = checkout_url;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not start checkout right now."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[calc(100dvh-1.5rem)] overflow-hidden bg-transparent px-1 pb-6 pt-4 sm:px-2"
    >
      <div className="relative mx-auto w-full max-w-[23rem]">
        <PlanCards
          freeBenefits={config.freeBenefits}
          vibeeBenefits={config.vibeeBenefits}
          vibeeMonthlyPrice={config.vibeeMonthlyPrice}
          onSelectFree={() => {
            trackEvent(analyticsEvents.freeAccountCtaTapped, { email });
            onChooseFree();
          }}
          onSelectVibee={() => void chooseVibee()}
          disabled={isSubmitting}
        />

        {message ? (
          <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
            {message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
