"use client";

import Image from "next/image";
import { type FormEvent, type RefObject, useEffect, useState } from "react";

import { trackEvent } from "@/app/lib/analytics";
import { analyticsEvents } from "@/app/lib/analyticsEvents";
import { type RuntimeConfig } from "@/app/lib/genieTypes";
import { type ConsumerAccount } from "@/app/lib/localState";
import {
  createSubscriptionCheckout,
  signUpUser,
} from "@/app/lib/publicApiClient";
import { ActionButton } from "./ui";

export type AccountScreenMode = "free" | "vibee" | "login" | null;

type ConsumerFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
};

function createEmptyConsumerForm(): ConsumerFormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    consent: false,
  };
}

function isEmailValid(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function normalizeBenefitLabel(value: string) {
  return value.replace(" and ", " & ");
}

function toMonthlyPriceLabel(value: string) {
  if (value.includes("/mo")) {
    return value.replace("/mo", " / month");
  }

  if (value.includes("/month")) {
    return value.replace("/month", " / month");
  }

  return value;
}

function BenefitList({ benefits }: { benefits: string[] }) {
  return (
    <ul className="mt-2.5 space-y-1 text-[13px] leading-relaxed text-gray-600 dark:text-white/72">
      {benefits.map((benefit) => (
        <li key={benefit} className="flex items-center gap-2.5">
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 flex-none text-red-500 dark:text-[#e8a45f]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3.25 8.5 2.5 2.5 6-6" />
          </svg>
          <span>{normalizeBenefitLabel(benefit)}</span>
        </li>
      ))}
    </ul>
  );
}

export function AccountSection({
  sectionRef,
  visible,
  account,
  config,
  onDismiss,
  onOpenVendor,
  onAccountChange,
  onModeChange,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  visible: boolean;
  account: ConsumerAccount | null;
  config: RuntimeConfig;
  onDismiss: () => void;
  onOpenVendor: () => void;
  onAccountChange: (account: ConsumerAccount, message: string) => void;
  onModeChange?: (mode: AccountScreenMode) => void;
}) {
  const [mode, setMode] = useState<AccountScreenMode>(null);
  const [form, setForm] = useState<ConsumerFormState>(createEmptyConsumerForm());
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    if (!visible) {
      setMode(null);
      setMessage(null);
      setForm(createEmptyConsumerForm());
    }
  }, [visible]);

  void onAccountChange;

  if (!visible) {
    return null;
  }

  const openFreeSignup = () => {
    setMode("free");
    setForm(createEmptyConsumerForm());
    setMessage(null);
  };

  const openVibeeSignup = () => {
    setMode("vibee");
    setForm(createEmptyConsumerForm());
    setMessage(null);
  };

  const submitSignup = async (
    event: FormEvent<HTMLFormElement>,
    membership: "free" | "vibee"
  ) => {
    event.preventDefault();
    const eventMap =
      membership === "free"
        ? {
            cta: analyticsEvents.freeAccountCtaTapped,
            start: analyticsEvents.freeSignupStarted,
            submit: analyticsEvents.freeSignupSubmitted,
            success: analyticsEvents.freeSignupCompleted,
            error: analyticsEvents.freeSignupValidationError,
          }
        : {
            cta: analyticsEvents.vibeeCtaTapped,
            start: analyticsEvents.vibeeSignupStarted,
            submit: analyticsEvents.vibeeCheckoutStarted,
            success: analyticsEvents.vibeeCheckoutCompleted,
            error: analyticsEvents.signupValidationError,
          };

    trackEvent(eventMap.cta, { membership });
    trackEvent(analyticsEvents.signupStarted, { membership });
    trackEvent(eventMap.start, { membership });

    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !isEmailValid(form.email) ||
      !form.consent
    ) {
      setMessage("Complete the required fields and accept the terms.");
      trackEvent(eventMap.error, { membership });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await signUpUser({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
      });

      setMessage(
        result.message ||
          "Check your email for a magic link to complete your account!"
      );
      trackEvent(eventMap.submit, { membership, email: form.email });
      trackEvent(eventMap.success, { membership, email: form.email });
      trackEvent(analyticsEvents.signupCompleted, { membership });
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "Could not create your account.";

      setMessage(nextMessage);
      trackEvent(eventMap.error, { membership, error: nextMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const upgradeToVibee = async () => {
    if (!account || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage("Redirecting to secure checkout...");
    trackEvent(analyticsEvents.vibeeCtaTapped, { email: account.email });
    trackEvent(analyticsEvents.vibeeCheckoutStarted, { email: account.email });

    try {
      const { checkout_url } = await createSubscriptionCheckout({});
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

  if (!account && (mode === "free" || mode === "vibee")) {
    const membership = mode === "free" ? "free" : "vibee";

    return (
      <section
        ref={sectionRef}
        className="relative min-h-screen overflow-hidden bg-white px-5 pb-32 pt-14 dark:bg-[#0a0000]"
      >
        <button
          type="button"
          onClick={() => setMode(null)}
          className="mb-5 flex-none text-gray-600 dark:text-white/82"
          aria-label="Go back"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
          </svg>
        </button>

        <h2 className="text-center text-[1.65rem] font-semibold leading-tight text-gray-900 dark:text-white">
          {mode === "free"
            ? "Create your Free Account"
            : "Create your V.I. Bee Membership"}
        </h2>
        <p className="mt-2 text-center text-[15px] text-gray-500 dark:text-white/60">
          Takes just 30 seconds
        </p>

        <form
          onSubmit={(event) => void submitSignup(event, membership)}
          className="mt-6 space-y-3"
        >
          <input
            type="text"
            value={form.firstName}
            onChange={(e) =>
              setForm((c) => ({ ...c, firstName: e.target.value }))
            }
            placeholder="First Name"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
          />
          <input
            type="text"
            value={form.lastName}
            onChange={(e) =>
              setForm((c) => ({ ...c, lastName: e.target.value }))
            }
            placeholder="Last Name"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((c) => ({ ...c, email: e.target.value }))
            }
            placeholder="Email"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
          />
          <input
            type="tel"
            value={form.phone}
            onChange={(e) =>
              setForm((c) => ({ ...c, phone: e.target.value }))
            }
            placeholder="Phone (Optional)"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
          />

          <label className="flex cursor-pointer items-start gap-3 pt-1 text-[13px] leading-relaxed text-gray-500 dark:text-white/60">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) =>
                setForm((c) => ({ ...c, consent: e.target.checked }))
              }
              className="mt-0.5 h-4 w-4 flex-none rounded border-gray-300 accent-red-600"
            />
            <span>
              I agree to the <span className="text-red-600 underline">Terms</span> and{" "}
              <span className="text-red-600 underline">Privacy Policy</span>
            </span>
          </label>

          {mode === "vibee" && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-center text-[14px] text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
              V.I.Bee Member - {config.vibeeMonthlyPrice}
            </div>
          )}

          <ActionButton type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait..."
              : mode === "free"
                ? "Ask Genie"
                : "Continue to Stripe Checkout"}
          </ActionButton>

          {mode === "vibee" && (
            <p className="text-center text-[11px] leading-relaxed text-gray-400 dark:text-white/40">
              Powered by Stripe - Cancel anytime.{"\n"}Renews monthly until
              cancelled. Terms Privacy
            </p>
          )}

          <p className="text-center text-[11px] text-gray-400 dark:text-white/40">
            By signing up, you agree to our <span className="text-red-600 dark:text-[#ff7b7b]">Terms</span> and{" "}
            <span className="text-red-600 dark:text-[#ff7b7b]">Privacy Policy</span>
          </p>
        </form>

        {message && (
          <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
            {message}
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden bg-white px-4 pb-32 pt-8 dark:bg-[#0a0000] sm:px-5"
    >
      {!account ? (
        <>
          <div className="relative mx-auto w-full max-w-[23rem]">
            <div className="rounded-[22px] border border-red-100 bg-red-50/40 px-3 py-2.5 dark:border-white/10 dark:bg-black/16">
              <div className="flex items-center gap-3">
                <div className="relative h-[82px] w-[82px] flex-none overflow-hidden rounded-full border-2 border-red-400 shadow-[0_0_16px_rgba(220,38,38,0.25)]">
                  <Image
                    src="/genie-profile-pic.png"
                    alt="Genie"
                    width={82}
                    height={82}
                    className="h-full w-full object-cover"
                  />
                </div>
                <h2 className="text-[1.45rem] leading-tight text-gray-900 dark:text-white">
                  Hi, I&apos;m Genie,
                  <br />
                  your social concierge.
                </h2>
              </div>
            </div>

            <p className="mt-8 text-center text-[15px] leading-relaxed text-gray-600 dark:text-white/72">
              Sign up so I can get you connected to your vibe, favorite food,
              social spaces, and more!
            </p>

            <div className="mt-8 space-y-3.5">
              <button
                type="button"
                onClick={openFreeSignup}
                className="w-full rounded-[22px] border border-gray-100 bg-white px-4 py-3.5 text-left shadow-[0_2px_16px_rgba(0,0,0,0.05)] transition hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:border-[#8c2b2b] dark:bg-black/20 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-14 w-14 flex-none items-center justify-center rounded-xl border-2 border-red-500 dark:border-0 dark:bg-transparent dark:p-0">
                    <Image
                      src="/free (1) 1 (1).png"
                      alt="Free plan"
                      width={44}
                      height={44}
                      className="h-9 w-9 object-contain dark:hidden"
                    />
                    <Image
                      src="/free (1) 1.png"
                      alt="Free plan"
                      width={44}
                      height={44}
                      className="hidden h-11 w-11 object-contain dark:block"
                    />
                  </div>
                  <div>
                    <p className="text-[16px] font-semibold text-red-600 dark:text-[#ff7b7b]">
                      Get started for free
                    </p>
                    <BenefitList benefits={config.freeBenefits} />
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={openVibeeSignup}
                className="w-full rounded-[22px] border border-gray-100 bg-white px-4 py-3.5 text-left shadow-[0_2px_16px_rgba(0,0,0,0.05)] transition hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:border-[#8c2b2b] dark:bg-black/20 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-14 w-14 flex-none items-center justify-center rounded-xl border-2 border-red-500 dark:border-0 dark:bg-transparent dark:p-0">
                    <Image
                      src="/bee-red 1 (1).png"
                      alt="V.I. Bee"
                      width={44}
                      height={44}
                      className="h-9 w-9 object-contain dark:hidden"
                    />
                    <Image
                      src="/bee-red 1.png"
                      alt="V.I. Bee"
                      width={44}
                      height={44}
                      className="hidden h-11 w-11 object-contain dark:block"
                    />
                  </div>
                  <div>
                    <p className="text-[16px] font-semibold text-red-600 dark:text-[#ff7b7b]">
                      Become a V.I. Bee
                    </p>
                    <p className="mt-0.5 text-[16px] text-red-500 dark:text-[#ff7b7b]">
                      {toMonthlyPriceLabel(config.vibeeMonthlyPrice)}
                    </p>
                    <BenefitList benefits={config.vibeeBenefits} />
                  </div>
                </div>
              </button>

              <p className="pt-1 text-center text-[15px] text-red-600 font-medium dark:text-[#ff7b7b]">
                Are you a venue or event host?
              </p>

              <button
                type="button"
                onClick={() => {
                  trackEvent(analyticsEvents.vendorSignupCtaTapped);
                  onOpenVendor();
                }}
                className="group relative flex w-full items-center justify-between rounded-[12px] border border-red-500 bg-red-600 px-3.5 py-2.5 text-left shadow-sm"
              >
                <span className="relative flex items-center gap-2.5">
                  <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-white/50 bg-white/20">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3 w-3 text-white"
                      fill="currentColor"
                    >
                      <path d="M9.23 7.16c-.89-.27-1.4-.52-1.4-1.08 0-.57.52-.95 1.33-.95.88 0 1.45.31 1.95.76l.91-1.24c-.57-.5-1.29-.84-2.33-.95V2.5h-1.3v1.21c-1.5.2-2.54 1.13-2.54 2.48 0 1.57 1.2 2.16 2.72 2.6.95.27 1.52.56 1.52 1.18 0 .58-.52 1.02-1.46 1.02-1.02 0-1.87-.43-2.48-1.01l-.93 1.17c.72.72 1.7 1.19 2.88 1.33V13.5h1.3v-1.09c1.7-.2 2.74-1.2 2.74-2.58 0-1.56-1.13-2.18-2.91-2.67" />
                    </svg>
                  </span>
                  <span className="text-[17px] font-semibold text-white">
                    Sign Up as a Vendor
                  </span>
                </span>
                <svg
                  viewBox="0 0 16 16"
                  className="relative h-4 w-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 3.5 4 4-4 4" />
                </svg>
              </button>

              <p className="pt-1 text-center text-[12px] leading-relaxed text-gray-400 dark:text-white/40">
                By signing up, you agree to our{" "}
                <span className="underline underline-offset-2">Privacy Policy</span>{" "}
                and <span className="underline underline-offset-2">Terms</span>
                <br />
                Already signed up?{" "}
                <button
                  type="button"
                  onClick={openFreeSignup}
                  className="text-red-600 underline underline-offset-2"
                >
                  Login
                </button>
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-center text-[1.65rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Hi {account.firstName}, Genie remembers you now.
          </h2>
          <p className="mt-2 text-center text-[15px] leading-relaxed text-gray-500 dark:text-white/60">
            {account.membership === "vibee"
              ? "Your V.I.Bee membership is active. Keep exploring and vendor onboarding is unlocked below."
              : "Your free account is active. Upgrade any time or keep asking, saving, and browsing."}
          </p>

          <div className="mt-6 rounded-[20px] border border-gray-100 bg-gray-50 p-5 dark:border-white/10 dark:bg-black/20">
            <p className="text-[11px] uppercase tracking-[0.26em] text-gray-400 dark:text-white/42">
              Membership
            </p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
              {account.membership === "vibee" ? "V.I.Bee Member" : "Free Member"}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-white/55">Signed in as {account.email}</p>
            <div className="mt-5 flex flex-col gap-3">
              {account.membership !== "vibee" && (
                <ActionButton
                  onClick={() => void upgradeToVibee()}
                  className="w-full"
                >
                  Upgrade to V.I.Bee
                </ActionButton>
              )}
              <ActionButton
                onClick={() => {
                  trackEvent(analyticsEvents.vendorSignupCtaTapped);
                  onOpenVendor();
                }}
                className="w-full"
              >
                Vendor onboarding
              </ActionButton>
              <ActionButton
                onClick={onDismiss}
                variant="secondary"
                className="w-full"
              >
                Keep browsing
              </ActionButton>
            </div>
          </div>
        </>
      )}

      {message && (
        <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
          {message}
        </div>
      )}
    </section>
  );
}
