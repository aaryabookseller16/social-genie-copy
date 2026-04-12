"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { type FlowAnchor } from "@/app/components/single-page/ui";

type DrawerMenuActionId =
  | "home"
  | "account"
  | "saved"
  | "offers"
  | "membership"
  | "vendor"
  | "how-it-works"
  | "contact"
  | "terms";

type DrawerMenuProps = {
  visible: boolean;
  activeScreen: FlowAnchor;
  onClose: () => void;
  onNavigate: (target: DrawerMenuActionId) => void;
};

const menuItems: Array<{ id: DrawerMenuActionId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "account", label: "My Account" },
  { id: "saved", label: "Saved Spots" },
  { id: "offers", label: "V.I.Bee Offers" },
  { id: "membership", label: "V.I.Bee Membership" },
  { id: "vendor", label: "Claim your business" },
  { id: "how-it-works", label: "How it works" },
  { id: "contact", label: "Contact" },
  { id: "terms", label: "Terms & Privacy" },
];

function isActiveItem(id: DrawerMenuActionId, activeScreen: FlowAnchor) {
  if (id === "membership" || id === "offers") {
    return activeScreen === "offers";
  }

  if (id === "account") {
    return activeScreen === "account";
  }

  if (id === "vendor") {
    return activeScreen === "vendor";
  }

  return id === activeScreen;
}

export function DrawerMenu({
  visible,
  activeScreen,
  onClose,
  onNavigate,
}: DrawerMenuProps) {
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!visible) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, visible]);

  if (!visible) {
    return null;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      <button
        type="button"
        aria-label="Close navigation menu"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative h-full w-[15rem] max-w-[84vw] overflow-hidden border-r border-white/12 bg-[linear-gradient(180deg,rgba(20,0,0,0.97),rgba(54,5,7,0.94)_54%,rgba(17,0,0,0.98))] px-6 py-8 text-left shadow-[24px_0_60px_rgba(0,0,0,0.38)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_12%,rgba(255,94,94,0.16),transparent_30%),radial-gradient(circle_at_70%_78%,rgba(164,18,18,0.2),transparent_24%)]" />

        <div className="relative flex h-full flex-col">
          <nav className="flex flex-1 flex-col">
            {menuItems.slice(0, 5).map((item) => {
              const active = isActiveItem(item.id, activeScreen);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`whitespace-nowrap py-2 text-left text-[0.98rem] leading-7 transition ${
                    active
                      ? "text-white"
                      : "text-white/78 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            <div className="py-2">
              <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="whitespace-nowrap text-left text-[0.98rem] leading-7 text-white/78 transition hover:text-white"
              >
                {`Switch to ${isDark ? "light" : "dark"} mode`}
              </button>
            </div>

            {menuItems.slice(5).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="whitespace-nowrap py-2 text-left text-[0.98rem] leading-7 text-white/78 transition hover:text-white"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
