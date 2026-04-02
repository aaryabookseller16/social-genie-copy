"use client";

import { type FormEvent, type RefObject, useEffect, useState } from "react";

import { trackEvent } from "@/app/lib/analytics";
import { analyticsEvents } from "@/app/lib/analyticsEvents";
import { type RuntimeConfig } from "@/app/lib/genieTypes";
import { type ConsumerAccount } from "@/app/lib/localState";
import {
  createSubscriptionCheckout,
  loginUser,
  persistAuthSession,
  signUpUser,
} from "@/app/lib/publicApiClient";
import { readSessionToken } from "@/app/lib/sessionToken";

import { ActionButton, Field, SectionShell } from "./ui";

export type AccountScreenMode = "free" | "vibee" | "login" | null;

type ConsumerFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  consent: boolean;
};

type LoginFormState = {
  email: string;
  password: string;
};

function createEmptyConsumerForm(): ConsumerFormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    consent: false,
  };
}

function createEmptyLoginForm(): LoginFormState {
  return {
    email: "",
    password: "",
  };
}

function isEmailValid(value: string) {
  return /\S+@\S+\.\S+/.test(value);
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
  const [loginForm, setLoginForm] = useState<LoginFormState>(createEmptyLoginForm());
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
      setLoginForm(createEmptyLoginForm());
    }
  }, [visible]);

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

  const openLogin = () => {
    setMode("login");
    setLoginForm(createEmptyLoginForm());
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
      !form.password.trim() ||
      !form.consent
    ) {
      setMessage("Complete the required fields and accept the terms.");
      trackEvent(eventMap.error, { membership });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const { token, user } = await signUpUser({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        session_token: readSessionToken(),
      });

      if (membership === "vibee") {
        const provisionalAccount = persistAuthSession(token, user, "inactive");
        onAccountChange(provisionalAccount, "Redirecting to secure checkout...");
        trackEvent(eventMap.submit, { membership, email: provisionalAccount.email });

        const { checkout_url } = await createSubscriptionCheckout();
        window.location.href = checkout_url;
        return;
      }

      const nextAccount = persistAuthSession(token, user, "inactive");
      const nextMessage =
        "Free account created. Your Genie progress now stays with you.";

      setMode(null);
      setMessage(nextMessage);
      onAccountChange(nextAccount, nextMessage);
      trackEvent(eventMap.submit, { membership, email: nextAccount.email });
      trackEvent(eventMap.success, { membership, email: nextAccount.email });
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

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isEmailValid(loginForm.email) || !loginForm.password.trim()) {
      setMessage("Enter a valid email and password.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const { token, user } = await loginUser({
        email: loginForm.email.trim(),
        password: loginForm.password,
      });

      const nextAccount = persistAuthSession(
        token,
        user,
        user.subscription_status ?? "inactive"
      );
      const nextMessage = `Welcome back, ${nextAccount.firstName}.`;

      setMode(null);
      setMessage(nextMessage);
      onAccountChange(nextAccount, nextMessage);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not log you in."
      );
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
      const { checkout_url } = await createSubscriptionCheckout();
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
      <SectionShell
        sectionRef={sectionRef}
        title={
          mode === "free"
            ? "Create your Free Account"
            : "Create your V.I. Bee Membership"
        }
        subtitle="Takes just 30 seconds"
      >
        <form
          onSubmit={(event) => void submitSignup(event, membership)}
          className="space-y-3"
        >
          <Field
            label="First Name"
            value={form.firstName}
            placeholder="First Name"
            onChange={(value) => setForm((current) => ({ ...current, firstName: value }))}
          />
          <Field
            label="Last Name"
            value={form.lastName}
            placeholder="Last Name"
            onChange={(value) => setForm((current) => ({ ...current, lastName: value }))}
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            placeholder="Email"
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
          />
          <Field
            label="Phone (optional)"
            value={form.phone}
            placeholder="Phone (optional)"
            onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
          />
          <p className="text-xs text-white/46">For updates and confirmations</p>
          <Field
            label="Password"
            type="password"
            value={form.password}
            placeholder="Password"
            onChange={(value) => setForm((current) => ({ ...current, password: value }))}
          />
          <label className="flex cursor-pointer items-center gap-3 text-sm text-white/72">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(event) =>
                setForm((current) => ({ ...current, consent: event.target.checked }))
              }
              className="h-4 w-4 rounded border-[#b74c4c] accent-[#e83434]"
            />
            I agree to the{" "}
            <span className="text-[#ff8080] underline">Terms</span> and{" "}
            <span className="text-[#ff8080] underline">Privacy Policy</span>
          </label>
          {mode === "vibee" ? (
            <div className="rounded-[18px] border border-white/10 bg-black/18 px-4 py-3 text-center text-sm text-white/72">
              V.I.Bee Member — {config.vibeeMonthlyPrice}
            </div>
          ) : null}
          <ActionButton type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait..."
              : mode === "free"
              ? "Ask Genie"
              : "Continue to Secure Checkout"}
          </ActionButton>
          <p className="text-center text-xs text-white/42">
            {mode === "vibee"
              ? "Powered by Stripe — Cancel anytime. Renews monthly until cancelled. Terms Privacy"
              : "By signing up, you agree to our Terms and Privacy Policy."}
          </p>
        </form>

        {message ? (
          <div className="mt-5 rounded-[20px] border border-white/10 bg-black/18 px-4 py-3 text-sm leading-6 text-white/76">
            {message}
          </div>
        ) : null}

        <p className="mt-5 text-center text-sm text-white/58">
          Already signed up?{" "}
          <button
            type="button"
            onClick={openLogin}
            className="font-semibold text-white underline underline-offset-2"
          >
            Log In
          </button>
        </p>
      </SectionShell>
    );
  }

  if (!account && mode === "login") {
    return (
      <SectionShell
        sectionRef={sectionRef}
        title="Log in"
        subtitle="Pick up where you left off."
      >
        <form onSubmit={(event) => void submitLogin(event)} className="space-y-4">
          <Field
            label="Email"
            type="email"
            value={loginForm.email}
            placeholder="Email"
            onChange={(value) =>
              setLoginForm((current) => ({ ...current, email: value }))
            }
          />
          <Field
            label="Password"
            type="password"
            value={loginForm.password}
            placeholder="Password"
            onChange={(value) =>
              setLoginForm((current) => ({ ...current, password: value }))
            }
          />
          <ActionButton type="submit" className="w-full" disabled={isSubmitting}>
            Log In
          </ActionButton>
        </form>

        {message ? (
          <div className="mt-5 rounded-[20px] border border-white/10 bg-black/18 px-4 py-3 text-sm leading-6 text-white/76">
            {message}
          </div>
        ) : null}
      </SectionShell>
    );
  }

  return (
    <SectionShell
      sectionRef={sectionRef}
      title={
        account
          ? `Hi ${account.firstName}, Genie remembers you now.`
          : "Hi, I'm Genie, your social concierge."
      }
      subtitle={
        account
          ? account.membership === "vibee"
            ? "Your V.I.Bee membership is active. Keep exploring and vendor onboarding is unlocked below."
            : "Your free account is active. Upgrade any time or keep asking, saving, and browsing."
          : "Sign up so I can get you connected to your vibe, favorite food, social spaces, and more!"
      }
    >
      {!account ? (
        <div className="space-y-3">
          {/* Free tier */}
          <div className="rounded-[24px] border border-[#8d3535] bg-black/18 p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#e83434] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                FREE
              </span>
              <p className="text-[17px] font-semibold text-white">
                Get started for free
              </p>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-white/74">
              {config.freeBenefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2">
                  <span className="text-[#e83434]">✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
            <ActionButton onClick={openFreeSignup} className="mt-4 w-full">
              Create free account
            </ActionButton>
          </div>

          {/* V.I.Bee tier */}
          <div className="rounded-[24px] border border-[#8d3535] bg-black/18 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[17px] font-semibold text-white">
                  Become a V.I.Bee
                </p>
                <p className="mt-0.5 text-[15px] font-semibold text-[#ffcd8e]">
                  {config.vibeeMonthlyPrice}
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-white/74">
              {config.vibeeBenefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2">
                  <span className="text-[#e83434]">✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
            <ActionButton onClick={openVibeeSignup} className="mt-4 w-full">
              Start membership
            </ActionButton>
          </div>

          {/* Vendor CTA */}
          <div className="rounded-[24px] border border-white/10 bg-black/18 p-4">
            <p className="text-[13px] uppercase tracking-[0.2em] text-white/40">
              Are you a venue or event host?
            </p>
            <ActionButton
              onClick={() => {
                trackEvent(analyticsEvents.vendorSignupCtaTapped);
                onOpenVendor();
              }}
              className="mt-3 w-full"
            >
              Sign Up as a Vendor &gt;
            </ActionButton>
          </div>

          <p className="text-center text-xs text-white/42">
            By signing up, you agree to our Privacy Policy and Terms
          </p>
          <p className="text-center text-sm text-white/58">
            Already signed up?{" "}
            <button
              type="button"
              onClick={openLogin}
              className="font-semibold text-white underline underline-offset-2"
            >
              Login
            </button>
          </p>
        </div>
      ) : (
        <div className="rounded-[24px] border border-white/10 bg-black/18 p-4">
          <p className="text-sm uppercase tracking-[0.26em] text-white/34">
            Membership
          </p>
          <p className="mt-2 text-2xl text-white">
            {account.membership === "vibee" ? "V.I.Bee Member" : "Free Member"}
          </p>
          <p className="mt-2 text-sm text-white/68">
            Signed in as {account.email}
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {account.membership !== "vibee" ? (
              <ActionButton onClick={() => void upgradeToVibee()} className="w-full">
                Upgrade to V.I.Bee
              </ActionButton>
            ) : null}
            <ActionButton
              onClick={() => {
                trackEvent(analyticsEvents.vendorSignupCtaTapped);
                onOpenVendor();
              }}
              className="w-full"
            >
              Vendor onboarding
            </ActionButton>
            <ActionButton onClick={onDismiss} variant="secondary" className="w-full">
              Keep browsing
            </ActionButton>
          </div>
        </div>
      )}

      {message ? (
        <div className="mt-5 rounded-[20px] border border-white/10 bg-black/18 px-4 py-3 text-sm leading-6 text-white/76">
          {message}
        </div>
      ) : null}
    </SectionShell>
  );
}
