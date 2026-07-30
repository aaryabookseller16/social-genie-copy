"use client";

import { useEffect } from "react";

import { type OnboardingRole } from "@/app/lib/localState";

const ROLE_LABELS: Record<OnboardingRole, string> = {
  consumer: "Discover & Go Out",
  vendor: "Vendor",
  producer: "Producer",
  influencer: "Influencer",
};

const ALL_SWITCHABLE_ROLES: OnboardingRole[] = [
  "vendor",
  "producer",
  "influencer",
];

type RoleSwitcherDialogProps = {
  visible: boolean;
  /** Roles unlocked server-side (account.roles) — the switcher never reads storage itself. */
  unlockedRoles: OnboardingRole[];
  onClose: () => void;
  onNavigateToRole: (role: OnboardingRole) => void;
  onUnlockNew: () => void;
};

export function RoleSwitcherDialog({
  visible,
  unlockedRoles,
  onClose,
  onNavigateToRole,
  onUnlockNew,
}: RoleSwitcherDialogProps) {
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, visible]);

  if (!visible) return null;

  const switchableUnlocked = ALL_SWITCHABLE_ROLES.filter((r) =>
    unlockedRoles.includes(r)
  );
  const hasLockedRoles = switchableUnlocked.length < ALL_SWITCHABLE_ROLES.length;

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label="Switch Profiles"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 overflow-hidden rounded-t-[28px] bg-white bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat shadow-[0_-12px_60px_rgba(0,0,0,0.18)] dark:bg-black dark:bg-[url('/bg.png')] dark:shadow-[0_-12px_60px_rgba(0,0,0,0.7)]">
        {/* Dark overlay for readability */}
        <div className="pointer-events-none absolute inset-0 hidden bg-black/55 dark:block" />

        <div className="relative px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)] pt-4">
          {/* Handle */}
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-300 dark:bg-white/25" />

          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[1.6rem] font-bold leading-tight text-gray-900 dark:text-white">
              Switch Profiles
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-900 dark:border-white/20 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20 dark:hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Role buttons */}
          {switchableUnlocked.length > 0 ? (
            <div className="space-y-3.5">
              {switchableUnlocked.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => onNavigateToRole(role)}
                  className="w-full rounded-[18px] border border-red-500 bg-red-600 hover:bg-red-700 dark:border-red-500/60 dark:bg-[linear-gradient(180deg,rgba(180,20,20,0.92),rgba(100,5,5,0.98))] px-4 py-4 text-center text-[1.1rem] font-bold text-white shadow-[0_0_0_1px_rgba(255,80,80,0.15),0_8px_24px_rgba(0,0,0,0.4)] transition hover:brightness-110 active:scale-[0.98]"
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-[0.95rem] text-gray-500 dark:text-white/60">
              You haven&apos;t unlocked any other profiles yet.
            </p>
          )}

          {/* Unlock button */}
          {hasLockedRoles ? (
            <div className="mt-5">
              <button
                type="button"
                onClick={onUnlockNew}
                className="w-full rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-3.5 text-center text-[0.95rem] font-semibold text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 dark:border-white/20 dark:bg-white/8 dark:text-white/80 dark:hover:bg-white/12 dark:hover:text-white"
              >
                + Unlock a new role
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
