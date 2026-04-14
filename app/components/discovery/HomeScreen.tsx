"use client";

import Image from "next/image";

import { GenieOrb } from "@/app/components/shared/GenieOrb";
import { QuickChips } from "@/app/components/shared/QuickChips";
import { ThemeToggle } from "@/app/components/shared/ThemeToggle";
import { type RuntimeConfig } from "@/app/lib/genieTypes";

type HomeScreenProps = {
  config: RuntimeConfig;
  inputValue: string;
  isSubmitting: boolean;
  showBottomNav?: boolean;
  onMenuOpen: () => void;
  onInputChange: (value: string) => void;
  onChipSelect: (prompt: string) => void;
  onOrbTap: () => void;
  onSubmit: () => void;
};

export function HomeScreen({
  config,
  inputValue,
  isSubmitting,
  onMenuOpen,
  onInputChange,
  onChipSelect,
  onOrbTap,
  onSubmit,
}: HomeScreenProps) {
  return (
    <section className="relative flex flex-1 flex-col overflow-hidden px-1 pb-0 pt-0 sm:px-3">

      <div className="relative mx-auto flex max-w-sm flex-1 flex-col items-center text-center">
        <div className="flex w-full items-center justify-between">
          <ThemeToggle />
          <button
            type="button"
            onClick={onMenuOpen}
            className="flex flex-col gap-[5px] p-2"
            aria-label="Menu"
          >
            <span className="block h-[2.5px] w-6 rounded-full bg-red-600 dark:bg-white/80" />
            <span className="block h-[2.5px] w-6 rounded-full bg-red-600 dark:bg-white/80" />
            <span className="block h-[2.5px] w-6 rounded-full bg-red-600 dark:bg-white/80" />
          </button>
        </div>

        <h1 className="mt-2 whitespace-nowrap font-[family:var(--font-display)] text-[1.5rem] font-semibold leading-[1.1] text-black dark:text-white sm:text-[1.85rem]">
          What&apos;s your vibe today?
        </h1>
        <p className="mt-1 max-w-[24ch] text-[0.85rem] leading-[1.2rem] text-gray-500 dark:text-white/70">
          Ask me anything, food, drinks or something to do.
        </p>

        <div className="relative mt-1 min-h-0 w-full max-w-[20rem] flex-1 max-h-[48vh]">
          <Image
            src="/orb.png"
            alt=""
            aria-hidden="true"
            width={420}
            height={420}
            priority
            className="pointer-events-none absolute left-[48%] top-1/2 z-0 h-auto w-[88%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain opacity-95"
          />
          <Image
            src="/genie-pic2.png"
            alt="Genie"
            width={420}
            height={680}
            priority
            className="relative z-10 mx-auto h-full w-auto max-w-[55%] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.25)]"
          />
        </div>

        <div className="mt-0 w-full shrink-0">
          <QuickChips
            chips={config.quickChips}
            onSelect={(chip) => onChipSelect(chip.prompt)}
          />
        </div>

        <div className="mt-1 shrink-0">
          <GenieOrb
            mode={isSubmitting ? "thinking" : "idle"}
            onClick={onOrbTap}
            disabled={isSubmitting}
            size={64}
          />
        </div>

        <form
          className="mt-1 w-full shrink-0 sm:mt-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label htmlFor="ask-genie" className="sr-only">
            Ask Genie
          </label>
          <div className="group relative">
            <span className="pointer-events-none absolute inset-0 rounded-full border border-gray-300 bg-white transition group-focus-within:border-red-400 dark:border-white/40 dark:bg-transparent dark:group-focus-within:border-white/70" />
            <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-gray-400 dark:text-white/60">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </span>
            <input
              id="ask-genie"
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="Ask Genie"
              autoComplete="off"
              className="relative z-10 w-full rounded-full bg-transparent py-2.5 pl-12 pr-5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white dark:placeholder:text-white/50"
            />
          </div>
        </form>
      </div>
    </section>
  );
}
