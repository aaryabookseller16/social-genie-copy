"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MenuItem = { label: string; href?: string; isDanger?: boolean };

const MENU: MenuItem[] = [
  { label: "Profile", href: "/profile" },
  { label: "Membership Level", href: "/subscription" },
  { label: "Location Settings", href: "/location" },
  { label: "Saved Spots", href: "/saved" },
  { label: "Legal", href: "/legal" },
  { label: "Settings", href: "/settings" },
  { label: "Logout", isDanger: true },
];

type Props = {
  /** "hamburger" for mobile, "profile" for web header */
  trigger?: "hamburger" | "profile";
  className?: string;
};

export default function HamburgerMenu({ trigger = "hamburger", className }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // ESC to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleSelect = (item: MenuItem) => {
    setOpen(false);

    if (item.isDanger) {
      try {
        localStorage.removeItem("genie_saved_venues_v1");
        localStorage.removeItem("genie_last_results_v1");
        localStorage.removeItem("genie_last_reply_v1");
        localStorage.removeItem("genie_token");
        sessionStorage.clear();
      } catch {}
      router.push("/");
      return;
    }

    if (item.href) router.push(item.href);
  };

  return (
    <>
      {/* TRIGGER */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className={[
          "inline-flex h-10 w-10 items-center justify-center rounded-full",
          "bg-white/70 dark:bg-black/40 backdrop-blur",
          "border border-zinc-200/60 dark:border-zinc-800/60",
          "shadow-sm hover:shadow-md transition",
          className || "",
        ].join(" ")}
      >
        <span className="sr-only">Menu</span>

        {trigger === "hamburger" ? (
          <div className="flex flex-col gap-[5px]">
            <span className="h-[2px] w-5 rounded bg-zinc-900 dark:bg-zinc-100" />
            <span className="h-[2px] w-5 rounded bg-zinc-900 dark:bg-zinc-100" />
            <span className="h-[2px] w-5 rounded bg-zinc-900 dark:bg-zinc-100" />
          </div>
        ) : (
          // Profile icon trigger
          <div className="h-7 w-7 rounded-full bg-zinc-900/10 dark:bg-white/10 flex items-center justify-center">
            <span className="text-sm">👤</span>
          </div>
        )}
      </button>

      {/* OVERLAY + DRAWER */}
      {open && (
        <div className="fixed inset-0 z-[9999]">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          {/* Drawer */}
          <div
            className={[
              "absolute right-0 top-0 h-full w-[320px] max-w-[85vw]",
              "bg-white dark:bg-zinc-950",
              "border-l border-zinc-200/60 dark:border-zinc-800/60",
              "shadow-2xl p-5",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Menu
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {MENU.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={[
                    "w-full rounded-xl px-4 py-3 text-left text-sm border transition",
                    item.isDanger
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                      : "border-zinc-200/60 bg-white hover:bg-zinc-50 text-zinc-900 dark:border-zinc-800/60 dark:bg-zinc-950 dark:hover:bg-zinc-900/50 dark:text-zinc-100",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
              Social Bevy • Genie
            </div>
          </div>
        </div>
      )}
    </>
  );
}
