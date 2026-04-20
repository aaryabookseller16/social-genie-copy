"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { type FlowAnchor } from "@/app/components/single-page/ui";

export type DrawerMenuActionId =
  | "home"
  | "profile"
  | "dashboard"
  | "preferences"
  | "saved"
  | "membership"
  | "offers"
  | "redemptions"
  | "how-genie-works"
  | "vendor"
  | "help-faq"
  | "contact"
  | "privacy"
  | "terms";

type DrawerMenuProps = {
  visible: boolean;
  activeScreen: FlowAnchor;
  isLoggedIn: boolean;
  isVendor?: boolean;
  onClose: () => void;
  onNavigate: (target: DrawerMenuActionId) => void;
  onLogout: () => void;
  onLogin: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
};

function isActiveItem(id: DrawerMenuActionId, activeScreen: FlowAnchor) {
  if (id === "membership") return activeScreen === "membership";
  if (id === "offers")
    return (
      activeScreen === "offers" ||
      activeScreen === "offer-detail" ||
      activeScreen === "offer-activated"
    );
  if (id === "redemptions") return activeScreen === "redemptions";
  if (id === "profile") return activeScreen === "profile";
  if (id === "dashboard") return activeScreen === "dashboard";
  if (id === "preferences") return activeScreen === "preferences";
  if (id === "saved") return activeScreen === "saved";
  if (id === "vendor") return activeScreen === "vendor";
  if (id === "home") return activeScreen === "home";
  return false;
}

function ToggleSwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative inline-flex h-[26px] w-[46px] flex-none items-center rounded-full border-2 transition-colors duration-200 focus:outline-none ${
        enabled
          ? "border-red-500 bg-red-600 dark:border-red-500 dark:bg-red-600"
          : "border-red-400 bg-transparent dark:border-white/25 dark:bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] transform rounded-full shadow transition-transform duration-200 ${
          enabled
            ? "translate-x-[20px] bg-white"
            : "translate-x-[2px] bg-red-500 dark:bg-white"
        }`}
      />
    </button>
  );
}

export function DrawerMenu({
  visible,
  activeScreen,
  isLoggedIn,
  isVendor = false,
  onClose,
  onNavigate,
  onLogout,
  onLogin,
  notificationsEnabled,
  onToggleNotifications,
}: DrawerMenuProps) {
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, visible]);

  if (!visible) return null;

  const isDark = resolvedTheme === "dark";

  // Sub-screens (Social Preferences / Saved Spots / V.I.Bee Offers /
  // Redemptions / Membership status) live inside My Profile and My Dashboard,
  // so the drawer itself stays flat to match the design.
  const primaryItems: Array<{ id: DrawerMenuActionId; label: string }> = [
    { id: "home", label: "Home" },
    { id: "profile", label: "My Profile" },
    { id: "dashboard", label: "My Dashboard" },
    { id: "how-genie-works", label: "How Genie Works" },
    {
      id: "vendor",
      label: isVendor ? "Vendor Dashboard" : "Claim Your Business",
    },
  ];

  const secondaryItems: Array<{ id: DrawerMenuActionId; label: string }> = [
    { id: "help-faq", label: "Help / FAQ's" },
    { id: "contact", label: "Contact Us" },
    { id: "privacy", label: "Privacy Policy" },
    { id: "terms", label: "Terms of Use" },
  ];


  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close navigation menu"
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px] dark:bg-black/50"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="relative flex h-full w-[16rem] max-w-[86vw] flex-col overflow-hidden bg-white bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat shadow-[24px_0_60px_rgba(0,0,0,0.18)] dark:bg-black dark:bg-[url('/bg.png')] dark:shadow-[24px_0_60px_rgba(0,0,0,0.5)]"
      >
        {/* Dark overlay for readability — dark mode only */}
        <div className="pointer-events-none absolute inset-0 hidden bg-black/55 dark:block" />

        {/* Drawer content */}
        <div className="relative flex h-full flex-col px-4 pb-4 pt-6">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Primary nav */}
            <nav className="flex flex-col gap-1.5">
              {primaryItems.map((item) => {
                const active = isActiveItem(item.id, activeScreen);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-left text-[0.97rem] font-medium leading-[1.2] transition ${
                      active
                        ? "bg-black/5 text-gray-900 dark:bg-white/12 dark:text-white"
                        : "text-gray-900 hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/8 dark:hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Divider */}
            <div className="my-2 h-px bg-black/10 dark:bg-white/15" />

            {/* Notifications toggle */}
            <div className="flex items-center justify-between px-2.5 py-1">
              <span className="text-[0.97rem] font-medium text-gray-900 dark:text-white/75">
                Notifications
              </span>
              <ToggleSwitch
                enabled={notificationsEnabled}
                onToggle={onToggleNotifications}
              />
            </div>

            {/* Dark Mode toggle */}
            <div className="flex items-center justify-between px-2.5 py-1">
              <span className="text-[0.97rem] font-medium text-gray-900 dark:text-white/75">
                Dark Mode
              </span>
              <ToggleSwitch
                enabled={isDark}
                onToggle={() => setTheme(isDark ? "light" : "dark")}
              />
            </div>

            {/* Divider */}
            <div className="my-2 h-px bg-black/10 dark:bg-white/15" />

            {/* Secondary nav */}
            <nav className="flex flex-col gap-0.5">
              {secondaryItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className="whitespace-nowrap rounded-lg px-2.5 py-1 text-left text-[0.97rem] font-medium text-gray-900 transition hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/8 dark:hover:text-white"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-2 shrink-0 border-t border-black/10 pt-2 dark:border-white/15">
            {isLoggedIn ? (
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1 text-left text-[0.97rem] font-medium text-gray-500 transition hover:bg-black/5 dark:font-semibold dark:text-red-400 dark:hover:bg-white/8 dark:hover:text-red-300"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1 text-left text-[0.97rem] font-semibold text-gray-900 transition hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/8 dark:hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Login / Sign Up
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
