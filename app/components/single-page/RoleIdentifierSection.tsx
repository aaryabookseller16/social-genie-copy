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
  alwaysOn?: boolean;
};

const ROLE_CARDS: RoleCard[] = [
  {
    role: "consumer",
    title: "Discover & Go Out",
    description: "Find spots and events that match your vibe.",
    alwaysOn: true,
  },
  {
    role: "vendor",
    title: "Own / Manage a Venue",
    description: "List your venue and reach the right crowd.",
  },
  {
    role: "producer",
    title: "Promote Events",
    description: "Get your events in front of locals.",
  },
  {
    role: "influencer",
    title: "Content Creator / Influencer",
    description: "Share your nights out and grow your audience.",
  },
];

export function RoleIdentifierSection({
  sectionRef,
  visible,
  onContinue,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  visible: boolean;
  // Receives the full selected role set (consumer always included). The parent
  // decides whether to route to role-setup (non-consumer roles) or completion.
  onContinue: (roles: OnboardingRole[]) => void;
}) {
  const [selected, setSelected] = useState<OnboardingRole[]>(() => {
    const stored = readSelectedRoles();
    return stored.length > 0 ? stored : ["consumer"];
  });

  if (!visible) {
    return null;
  }

  const toggle = (card: RoleCard) => {
    if (card.alwaysOn) {
      return;
    }
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
      className="relative flex min-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden bg-transparent px-1 pb-6 pt-10"
    >
      <div className="flex flex-1 flex-col">
        <h2 className="mt-2 text-center text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
          How do you want to use Genie?
        </h2>
        <p className="mx-auto mt-3 max-w-[30ch] text-center text-[15px] leading-relaxed text-gray-700 dark:text-white/70">
          Pick everything that fits. You can add more later — these just unlock
          extra tools.
        </p>

        <div className="mt-8 space-y-3.5">
          {ROLE_CARDS.map((card) => {
            const isSelected = card.alwaysOn || selected.includes(card.role);
            return (
              <button
                key={card.role}
                type="button"
                onClick={() => toggle(card)}
                aria-pressed={isSelected}
                disabled={card.alwaysOn}
                className={`w-full rounded-[22px] border px-4 py-3.5 text-left transition ${
                  isSelected
                    ? "border-red-500 bg-red-50 dark:border-[#ff7b7b] dark:bg-black/35"
                    : "border-gray-300 bg-transparent hover:bg-white/30 dark:border-white/20 dark:bg-black/25 dark:hover:bg-black/35"
                } ${card.alwaysOn ? "cursor-default" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[16px] font-semibold text-red-600 dark:text-[#ff7b7b]">
                      {card.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600 dark:text-white/70">
                      {card.description}
                    </p>
                    {card.alwaysOn ? (
                      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-white/45">
                        Always on
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 transition ${
                      isSelected
                        ? "border-red-600 bg-red-600 text-white dark:border-[#ff7b7b] dark:bg-red-600"
                        : "border-gray-300 dark:border-white/30"
                    }`}
                  >
                    {isSelected ? (
                      <svg
                        viewBox="0 0 16 16"
                        className="h-3.5 w-3.5"
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
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-8">
        <ActionButton
          className="w-full"
          onClick={() => persistAndContinue(selected)}
        >
          Continue
        </ActionButton>
        <button
          type="button"
          onClick={() => persistAndContinue(["consumer"])}
          className="w-full rounded-2xl bg-black/10 px-4 py-3 text-[15px] font-semibold text-red-600 transition hover:bg-black/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
        >
          Skip — just exploring
        </button>
      </div>
    </section>
  );
}
