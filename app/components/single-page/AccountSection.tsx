"use client";

import { type FormEvent, type RefObject, useEffect, useState } from "react";

import { trackEvent } from "@/app/lib/analytics";
import { analyticsEvents } from "@/app/lib/analyticsEvents";
import { type ConsumerAccount } from "@/app/lib/localState";
import {
  createSubscriptionCheckout,
  signUpUser,
  toConsumerAccount,
  updateUserProfile,
} from "@/app/lib/publicApiClient";
import ImageUploader from "@/app/components/ImageUploader";
import { ActionButton } from "./ui";

// "vibee" is gone as a signup mode — the tier is chosen after verification on
// the plan chooser, so signup only ever creates a free account first.
export type AccountScreenMode = "free" | "login" | null;

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

const PROFILE_INPUT_CLASS =
  "w-full rounded-2xl border border-gray-300 bg-transparent px-4 py-3.5 text-gray-900 placeholder:text-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]";

export function AccountSection({
  sectionRef,
  visible,
  account,
  onDismiss,
  onOpenVendor,
  onOpenOffers,
  onOpenPreferences,
  onAccountChange,
  onAdvanceOnboarding,
  authError,
  onAuthErrorShown,
  requestedMode,
  onRequestedModeApplied,
  notice,
  onNoticeShown,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  visible: boolean;
  account: ConsumerAccount | null;
  onDismiss: () => void;
  onOpenVendor: () => void;
  onOpenOffers: () => void;
  onOpenPreferences: () => void;
  onAccountChange: (account: ConsumerAccount, message: string) => void;
  // Free signup sends a magic link but does not wait for it — advance the
  // onboarding wizard (Step 2) on the guest session instead of dead-ending.
  onAdvanceOnboarding?: (email: string) => void;
  // Surfaced when a magic-link exchange fails (expired/already used/etc.) so
  // the failure isn't silent — see SinglePageGenieApp's token-exchange catch.
  authError?: string | null;
  onAuthErrorShown?: () => void;
  // Opens a specific auth form when a gated screen sends the user here, rather
  // than always landing on login. Cleared via onRequestedModeApplied once used,
  // so it does not force the same form on an unrelated later visit.
  requestedMode?: AccountScreenMode;
  onRequestedModeApplied?: () => void;
  // Explains why a gated action sent the user here (e.g. tapping a V.I.Bee
  // offer as a free member). Cleared once shown so it does not reappear when
  // the user opens the account screen on their own later.
  notice?: string | null;
  onNoticeShown?: () => void;
}) {
  const [mode, setMode] = useState<AccountScreenMode>("login");
  // Modes the user passed through to reach `mode`, so the back arrow can retrace
  // them. Empty means this screen was entered directly (a gated action elsewhere
  // in the app navigated here), and back has to leave the account screen
  // entirely via onDismiss.
  const [modeHistory, setModeHistory] = useState<AccountScreenMode[]>([]);
  const [form, setForm] = useState<ConsumerFormState>(createEmptyConsumerForm());
  const [message, setMessage] = useState<string | null>(null);
  // Held locally so the banner survives the parent clearing the `notice` prop.
  const [gateNotice, setGateNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* profile edit form */
  const [editingProfile, setEditingProfile] = useState(false);
  const [profFirstName, setProfFirstName] = useState("");
  const [profLastName, setProfLastName] = useState("");
  const [profPhone, setProfPhone] = useState("");
  const [profDisplayName, setProfDisplayName] = useState("");
  const [profAvatarUrls, setProfAvatarUrls] = useState<string[]>([]);
  const [profUploading, setProfUploading] = useState(false);
  const [profBusy, setProfBusy] = useState(false);
  const [profError, setProfError] = useState<string | null>(null);

  function openEditProfile() {
    if (!account) return;
    setProfFirstName(account.firstName ?? "");
    setProfLastName(account.lastName ?? "");
    setProfPhone(account.phone ?? "");
    setProfDisplayName(account.displayName ?? "");
    setProfAvatarUrls(account.avatarUrl ? [account.avatarUrl] : []);
    setProfUploading(false);
    setProfError(null);
    setEditingProfile(true);
  }

  async function handleProfileSave(event: FormEvent) {
    event.preventDefault();
    if (!account) return;
    if (!profFirstName.trim()) {
      setProfError("First name is required.");
      return;
    }
    if (profUploading) {
      setProfError("Please wait for your photo to finish uploading.");
      return;
    }

    setProfBusy(true);
    setProfError(null);
    try {
      const { user } = await updateUserProfile({
        first_name: profFirstName.trim(),
        last_name: profLastName.trim(),
        phone: profPhone.trim(),
        display_name: profDisplayName.trim(),
        avatar_url: profAvatarUrls[0] ?? "",
      });
      // Carry the existing subscription status through. `auth/update_profile`
      // returns only `membership_active` from genie_user, which can disagree
      // with Stripe — re-deriving from it would flash a V.I.Bee member as Free
      // until hydrateAuthenticatedSession() catches up.
      onAccountChange(
        toConsumerAccount(user, account.subscriptionStatus),
        "Profile updated."
      );
      setEditingProfile(false);
    } catch (error) {
      setProfError(
        error instanceof Error ? error.message : "Could not save your profile."
      );
    } finally {
      setProfBusy(false);
    }
  }

  useEffect(() => {
    if (!visible) {
      setMode("login");
      setModeHistory([]);
      setMessage(null);
      setGateNotice(null);
      setForm(createEmptyConsumerForm());
    }
  }, [visible]);

  useEffect(() => {
    if (visible && authError) {
      setMode("login");
      setMessage(authError);
      onAuthErrorShown?.();
    }
  }, [visible, authError, onAuthErrorShown]);

  useEffect(() => {
    if (visible && notice) {
      setGateNotice(notice);
      onNoticeShown?.();
    }
  }, [visible, notice, onNoticeShown]);

  useEffect(() => {
    if (visible && requestedMode) {
      setMode(requestedMode);
      // Entered from a gated screen, so there is no in-screen hop to retrace —
      // back must hand straight back to the caller.
      setModeHistory([]);
      setMessage(null);
      onRequestedModeApplied?.();
    }
  }, [visible, requestedMode, onRequestedModeApplied]);

  void onAccountChange;

  if (!visible) {
    return null;
  }

  const openMode = (next: AccountScreenMode) => {
    setModeHistory((prev) => [...prev, mode]);
    setMode(next);
    setForm(createEmptyConsumerForm());
    setMessage(null);
  };

  const openFreeSignup = () => openMode("free");

  const openLogin = () => openMode("login");

  // Retrace an in-screen hop (login ⇄ signup) if there was one; otherwise hand
  // back to the caller, which pops the app's own screen history and returns the
  // user to the event/offer/feed item they came from.
  const goBackFromAuthForm = () => {
    if (modeHistory.length > 0) {
      setModeHistory((prev) => prev.slice(0, -1));
      setMode(modeHistory[modeHistory.length - 1]);
      setMessage(null);
      return;
    }
    onDismiss();
  };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isEmailValid(form.email)) {
      setMessage("Enter the email you signed up with.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await signUpUser({
        email: form.email.trim(),
        intent: "login",
      });
      setMessage(
        result.message ||
          "Check your email for a one-tap magic link to sign in."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not send your magic link."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // The tier is no longer chosen here — it's committed after verification on
  // the plan chooser, so signup only ever creates the account + sends a link.
  const submitSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    trackEvent(analyticsEvents.freeAccountCtaTapped);
    trackEvent(analyticsEvents.signupStarted);
    trackEvent(analyticsEvents.freeSignupStarted);

    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !isEmailValid(form.email) ||
      !form.consent
    ) {
      setMessage("Complete the required fields and accept the terms.");
      trackEvent(analyticsEvents.freeSignupValidationError);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await signUpUser({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        intent: "signup",
      });
      trackEvent(analyticsEvents.freeSignupSubmitted, { email: form.email });
      trackEvent(analyticsEvents.signupCompleted);

      // Magic link sent — hold here until they verify. The plan chooser (and
      // any Stripe checkout) comes after the link is clicked.
      if (onAdvanceOnboarding) {
        onAdvanceOnboarding(form.email.trim());
      } else {
        setMessage(
          result.message ||
            "Check your email for a magic link to complete your account!"
        );
      }
    } catch (error) {
      const nextMessage =
        error instanceof Error
          ? error.message
          : "Could not create your account.";
      setMessage(nextMessage);
      trackEvent(analyticsEvents.freeSignupValidationError, {
        error: nextMessage,
      });
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

  // Any non-"free" mode falls through to login: it is the only entry point for
  // a logged-out visitor now that the standalone signup pitch is gone.
  if (!account && mode !== "free") {
    return (
      <section
        ref={sectionRef}
        className="relative flex min-h-[calc(100dvh-1.5rem)] flex-col bg-transparent px-1 pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] pt-6"
      >
        <button
          type="button"
          onClick={goBackFromAuthForm}
          className="-ml-1 flex h-9 w-9 flex-none items-center justify-center text-gray-600 dark:text-white/82"
          aria-label="Go back"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
          </svg>
        </button>

        <div className="flex flex-1 flex-col">
          <h2 className="mt-2 text-center text-[1.85rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Welcome back
          </h2>
          <p className="mx-auto mt-3 max-w-[28ch] text-center text-[16px] leading-relaxed text-gray-700 dark:text-white/70">
            Enter your email and I&apos;ll send you a magic link to get back into your account.
          </p>

          <form onSubmit={(event) => void submitLogin(event)} className="mt-8 space-y-4">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              placeholder="Your Email"
              autoComplete="email"
              style={{ fontSize: "16px" }}
            className="w-full rounded-2xl border border-gray-300 bg-transparent px-4 py-3.5 text-gray-900 placeholder:text-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
            />
            <ActionButton type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send my link"}
            </ActionButton>
          </form>

          <p className="mx-auto mt-4 max-w-[32ch] text-center text-[14px] leading-relaxed text-gray-700 dark:text-white/50">
            We&apos;ll send you a one-tap magic link so you can sign in easily. No password needed.
          </p>

          {message && (
            <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
              {message}
            </div>
          )}
        </div>

        <div className="mt-auto pt-8">
          <p className="text-center text-[14px] text-gray-700 dark:text-white/55">
            Don&apos;t have an account?
          </p>
          <button
            type="button"
            onClick={openFreeSignup}
            className="mt-3 w-full rounded-2xl bg-black/10 px-4 py-3.5 text-[18px] font-semibold text-red-600 transition hover:bg-black/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            Create a free account
          </button>
        </div>
      </section>
    );
  }

  if (!account && mode === "free") {
    return (
      <section
        ref={sectionRef}
        className="relative flex min-h-[calc(100dvh-1.5rem)] flex-col bg-transparent px-1 pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] pt-6"
      >
        <button
          type="button"
          onClick={goBackFromAuthForm}
          className="-ml-1 flex h-9 w-9 flex-none items-center justify-center text-gray-600 dark:text-white/82"
          aria-label="Go back"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
          </svg>
        </button>

        <div className="flex flex-1 flex-col">
          <h2 className="mt-2 text-center text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Create your Free Account
          </h2>
          <p className="mt-2 text-center text-[16px] text-gray-700 dark:text-white/60">
            Takes just 30 seconds
          </p>

          <form
            onSubmit={(event) => void submitSignup(event)}
            className="mt-6 space-y-3"
          >
          <input
            type="text"
            value={form.firstName}
            onChange={(e) =>
              setForm((c) => ({ ...c, firstName: e.target.value }))
            }
            placeholder="First Name"
            style={{ fontSize: "16px" }}
            className="w-full rounded-2xl border border-gray-300 bg-transparent px-4 py-3.5 text-gray-900 placeholder:text-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
          />
          <input
            type="text"
            value={form.lastName}
            onChange={(e) =>
              setForm((c) => ({ ...c, lastName: e.target.value }))
            }
            placeholder="Last Name"
            style={{ fontSize: "16px" }}
            className="w-full rounded-2xl border border-gray-300 bg-transparent px-4 py-3.5 text-gray-900 placeholder:text-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((c) => ({ ...c, email: e.target.value }))
            }
            placeholder="Email"
            style={{ fontSize: "16px" }}
            className="w-full rounded-2xl border border-gray-300 bg-transparent px-4 py-3.5 text-gray-900 placeholder:text-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
          />
          <label className="flex cursor-pointer items-center gap-2 pt-1 text-[14px] leading-relaxed text-gray-800 dark:text-white/60">
            <span className="relative flex h-5 w-5 flex-none items-center justify-center">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) =>
                  setForm((c) => ({ ...c, consent: e.target.checked }))
                }
                className="peer sr-only"
              />
              <span className="h-5 w-5 rounded-full border-2 border-red-500 bg-white transition peer-checked:border-red-600 peer-checked:bg-red-600 peer-focus-visible:ring-2 peer-focus-visible:ring-red-500/30 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:peer-checked:border-[#ff6a6a] dark:peer-checked:bg-red-600" />
              <svg
                viewBox="0 0 16 16"
                className="pointer-events-none absolute h-3 w-3 text-white opacity-0 transition peer-checked:opacity-100"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m3.25 8.5 2.5 2.5 6-6" />
              </svg>
            </span>
            <span>
              I agree to the <span className="text-red-600 underline">Terms</span> and{" "}
              <span className="text-red-600 underline">Privacy Policy</span>
            </span>
          </label>

          <ActionButton type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : "Create Account"}
          </ActionButton>

          {message && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
              {message}
            </div>
          )}
          </form>
        </div>

        <div className="mt-auto pt-8">
          <p className="text-center text-[14px] text-gray-700 dark:text-white/55">
            Already have an account?
          </p>
          <button
            type="button"
            onClick={openLogin}
            className="mt-3 w-full rounded-2xl bg-black/10 px-4 py-3.5 text-[18px] font-semibold text-red-600 transition hover:bg-black/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            Login
          </button>
        </div>
      </section>
    );
  }

  // Unreachable: the two branches above cover every logged-out mode. Kept so the
  // profile view below can rely on `account` being present.
  if (!account) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[calc(100dvh-1.5rem)] bg-transparent px-1 pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] pt-4 sm:px-2"
    >
      {editingProfile ? (
        <>
          <h2 className="text-center text-[1.65rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Edit your profile
          </h2>

          <form onSubmit={(e) => void handleProfileSave(e)} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
                Profile photo
              </label>
              <ImageUploader
                mode="single"
                folder="avatars"
                value={profAvatarUrls}
                onChange={setProfAvatarUrls}
                onUploadingChange={setProfUploading}
              />
            </div>

            <input
              type="text"
              value={profFirstName}
              onChange={(e) => setProfFirstName(e.target.value)}
              placeholder="First name"
              style={{ fontSize: "16px" }}
              className={PROFILE_INPUT_CLASS}
            />
            <input
              type="text"
              value={profLastName}
              onChange={(e) => setProfLastName(e.target.value)}
              placeholder="Last name"
              style={{ fontSize: "16px" }}
              className={PROFILE_INPUT_CLASS}
            />
            <input
              type="text"
              value={profDisplayName}
              onChange={(e) => setProfDisplayName(e.target.value)}
              placeholder="Display name"
              style={{ fontSize: "16px" }}
              className={PROFILE_INPUT_CLASS}
            />
            <input
              type="tel"
              value={profPhone}
              onChange={(e) => setProfPhone(e.target.value)}
              placeholder="Phone"
              style={{ fontSize: "16px" }}
              className={PROFILE_INPUT_CLASS}
            />

            {/* Email is the magic-link login identity and cannot be changed here. */}
            <div>
              <input
                type="email"
                value={account.email}
                readOnly
                disabled
                style={{ fontSize: "16px" }}
                className={`${PROFILE_INPUT_CLASS} cursor-not-allowed opacity-60`}
              />
              <p className="mt-1.5 text-[11px] text-gray-400 dark:text-white/40">
                Your email is how you sign in, so it can&apos;t be changed here.
              </p>
            </div>

            {profError ? (
              <p className="text-sm text-red-500 dark:text-red-400">{profError}</p>
            ) : null}

            <div className="flex gap-3 pt-1">
              <ActionButton
                variant="secondary"
                className="flex-1"
                onClick={() => setEditingProfile(false)}
              >
                Cancel
              </ActionButton>
              <ActionButton
                type="submit"
                className="flex-1"
                disabled={profBusy || profUploading}
              >
                {profUploading ? "Uploading…" : profBusy ? "Saving…" : "Save"}
              </ActionButton>
            </div>
          </form>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onDismiss}
            className="-ml-1 mb-2 flex h-9 w-9 flex-none items-center justify-center text-gray-600 dark:text-white/82"
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
            </svg>
          </button>

          {gateNotice ? (
            <div className="mb-5 flex items-start gap-3 rounded-[18px] border border-[#E7070380] bg-red-50 px-4 py-3.5 text-left dark:bg-[rgba(120,10,10,0.35)]">
              <svg
                viewBox="0 0 24 24"
                className="mt-0.5 h-5 w-5 flex-none text-red-500 dark:text-red-300"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p className="text-[0.86rem] leading-relaxed text-gray-700 dark:text-white/75">
                {gateNotice}
              </p>
            </div>
          ) : null}

          {account.avatarUrl ? (
            <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border-2 border-red-400 shadow-[0_0_16px_rgba(220,38,38,0.35)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={account.avatarUrl}
                alt={account.displayName || account.firstName}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}

          <h2 className="text-center text-[1.65rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Hi {account.displayName || account.firstName}, Genie remembers you now.
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
              {account.membership === "vibee" ? (
                <ActionButton onClick={onOpenOffers} className="w-full">
                  View V.I.Bee Offers
                </ActionButton>
              ) : null}
              <ActionButton onClick={openEditProfile} className="w-full">
                Edit profile
              </ActionButton>
              <ActionButton onClick={onOpenPreferences} className="w-full">
                Tune my preferences
              </ActionButton>
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
