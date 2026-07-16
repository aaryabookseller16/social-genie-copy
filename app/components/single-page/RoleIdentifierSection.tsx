"use client";

import { type RefObject, useState } from "react";

import { trackEvent } from "@/app/lib/analytics";
import { analyticsEvents } from "@/app/lib/analyticsEvents";
import {
  readSelectedRoles,
  writeSelectedRoles,
  type OnboardingRole,
} from "@/app/lib/localState";
import { setUserRoles } from "@/app/lib/publicApiClient";
import { ActionButton } from "./ui";

type RoleCard = {
  role: OnboardingRole;
  title: string;
  description: string;
};

// "consumer" isn't listed — it's implicit for every account and gets merged in
// on submit, so this screen only offers the roles that unlock extra tools.
const ROLE_CARDS: RoleCard[] = [
  {
    role: "vendor",
    title: "Venue",
    description: "You have a space for social activities.",
  },
  {
    role: "producer",
    title: "Producer",
    description: "Creators of social experiences",
  },
  {
    role: "influencer",
    title: "Influencer",
    description: "Content creators moving people to places.",
  },
];

export function RoleIdentifierSection({
  sectionRef,
  visible,
  onContinue,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  visible: boolean;
  // Receives the full selected role set (consumer always included).
  onContinue: (roles: OnboardingRole[]) => void;
}) {
  const [selected, setSelected] = useState<OnboardingRole[]>(() =>
    readSelectedRoles().filter((role) => role !== "consumer")
  );

  if (!visible) {
    return null;
  }

  const toggle = (card: RoleCard) => {
    setSelected((prev) =>
      prev.includes(card.role)
        ? prev.filter((role) => role !== card.role)
        : [...prev, card.role]
    );
  };

  const persistAndContinue = (roles: OnboardingRole[]) => {
    const next = Array.from(new Set<OnboardingRole>(["consumer", ...roles]));
    writeSelectedRoles(next);
    trackEvent(analyticsEvents.onboardingRolesSelected, { roles: next });
    // Fire-and-forget: save to server. No-op if Xano endpoint not yet published.
    setUserRoles(next).catch(() => {});
    onContinue(next);
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[calc(100dvh-1.5rem)] overflow-hidden bg-transparent px-1 pb-6 pt-10"
    >
      <div className="mx-auto w-full max-w-[23rem]">
        <h2 className="mt-2 text-center text-[1.85rem] font-semibold leading-tight text-gray-900 dark:text-white">
          Select Your Role
        </h2>
        <p className="mt-2 text-center text-[16px] text-gray-700 dark:text-white/60">
          Takes just 30 seconds
        </p>

        <div className="mt-8 space-y-5">
          {ROLE_CARDS.map((card) => {
            const isSelected = selected.includes(card.role);
            return (
              <button
                key={card.role}
                type="button"
                onClick={() => toggle(card)}
                aria-pressed={isSelected}
                className="flex w-full items-start gap-4 text-left"
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 transition ${
                    isSelected
                      ? "border-red-600 bg-red-600 text-white dark:border-[#ff7b7b] dark:bg-red-600"
                      : "border-gray-300 dark:border-white/25"
                  }`}
                >
                  {isSelected ? (
                    <svg
                      viewBox="0 0 16 16"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m3.25 8.5 2.5 2.5 6-6" />
                    </svg>
                  ) : null}
                </span>
                <span className="flex-1">
                  <span className="block text-[17px] font-medium text-gray-900 dark:text-white">
                    {card.title}
                  </span>
                  <span className="mt-1 block text-[15px] leading-relaxed text-gray-600 dark:text-white/60">
                    {card.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-7 text-center text-[15px] text-gray-600 dark:text-white/55">
          You can select multiple roles
        </p>

        <div className="mt-5 space-y-3">
          <ActionButton
            className="w-full"
            onClick={() => persistAndContinue(selected)}
          >
            Next
          </ActionButton>
          <button
            type="button"
            onClick={() => persistAndContinue([])}
            className="w-full rounded-2xl bg-black/10 px-4 py-3.5 text-[18px] font-semibold text-red-600 transition hover:bg-black/15 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15"
          >
            Skip
          </button>
        </div>
      </div>
    </section>
  );
}
