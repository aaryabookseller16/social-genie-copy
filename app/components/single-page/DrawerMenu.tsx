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
  | "how-genie-works"
  | "vendor"
  | "help-faq"
  | "contact"
  | "privacy"
  | "terms";

type DrawerMenuProps = {
  visible: boolean;
  activeScreen: FlowAnchor;
  onClose: () => void;
  onNavigate: (target: DrawerMenuActionId) => void;
  onLogout: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
};

function isActiveItem(id: DrawerMenuActionId, activeScreen: FlowAnchor) {
  if (id === "membership") return activeScreen === "offers";
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
          ? "border-red-500 bg-red-600"
          : "border-white/25 bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? "translate-x-[20px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

export function DrawerMenu({
  visible,
  activeScreen,
  onClose,
  onNavigate,
  onLogout,
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

  const primaryItems: Array<{ id: DrawerMenuActionId; label: string }> = [
    { id: "home", label: "Home" },
    { id: "profile", label: "My Profile" },
    { id: "dashboard", label: "Dashboard" },
    { id: "preferences", label: "Social Preferences" },
    { id: "saved", label: "Saved Spots" },
    { id: "membership", label: "Membership" },
    { id: "how-genie-works", label: "How Genie Works" },
    { id: "vendor", label: "Claim your business" },
  ];

  const secondaryItems: Array<{ id: DrawerMenuActionId; label: string }> = [
    { id: "help-faq", label: "Help / FAQ's" },
    { id: "contact", label: "Contact Us" },
    { id: "privacy", label: "Privacy Policy" },
    { id: "terms", label: "Terms of use" },
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
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="relative flex h-full w-[15.5rem] max-w-[86vw] flex-col overflow-hidden bg-cover bg-center shadow-[24px_0_60px_rgba(0,0,0,0.5)]"
        style={{ backgroundImage: "url(/bg.png)" }}
      >
        {/* Dark overlay for readability */}
        <div className="pointer-events-none absolute inset-0 bg-black/55" />

        {/* Scrollable content */}
        <div className="relative flex h-full flex-col overflow-y-auto px-5 pb-6 pt-8">
          {/* Primary nav */}
          <nav className="flex flex-col">
            {primaryItems.map((item) => {
              const active = isActiveItem(item.id, activeScreen);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-[0.92rem] font-medium leading-5 transition ${
                    active
                      ? "bg-white/12 text-white"
                      : "text-white/75 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="my-2.5 h-px bg-white/15" />

          {/* Notifications toggle */}
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[0.92rem] font-medium text-white/75">
              Notifications
            </span>
            <ToggleSwitch
              enabled={notificationsEnabled}
              onToggle={onToggleNotifications}
            />
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-[0.92rem] font-medium text-white/75 transition hover:bg-white/8 hover:text-white"
          >
            {`Switch to ${isDark ? "light" : "dark"} mode`}
          </button>

          {/* Divider */}
          <div className="my-2.5 h-px bg-white/15" />

          {/* Secondary nav */}
          <nav className="flex flex-col">
            {secondaryItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-[0.92rem] font-medium text-white/75 transition hover:bg-white/8 hover:text-white"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Spacer to push logout to bottom */}
          <div className="flex-1" />

          {/* Divider */}
          <div className="mb-2 mt-3 h-px bg-white/15" />

          {/* Logout */}
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-[0.92rem] font-semibold text-red-400 transition hover:bg-white/8 hover:text-red-300"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 flex-none"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
