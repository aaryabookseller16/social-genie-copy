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
  onInputChange: (value: string) => void;
  onChipSelect: (prompt: string) => void;
  onOrbTap: () => void;
  onSubmit: () => void;
};

export function HomeScreen({
  config,
  inputValue,
  isSubmitting,
  onInputChange,
  onChipSelect,
  onOrbTap,
  onSubmit,
}: HomeScreenProps) {
  return (
    <section className="relative flex flex-1 flex-col overflow-hidden bg-white px-5 pb-4 pt-6 dark:bg-[linear-gradient(180deg,rgba(20,0,0,0.96),rgba(42,4,4,0.92)_52%,rgba(15,0,0,0.98))] sm:px-7 sm:pb-6 sm:pt-10">
      <div className="pointer-events-none absolute inset-0 hidden dark:block dark-glow-top" />
      <div className="pointer-events-none absolute inset-0 hidden dark:block dark-noise" />

      <div className="relative mx-auto flex max-w-sm flex-1 flex-col items-center text-center">
        <div className="flex w-full items-center justify-between">
          <ThemeToggle />
          <button type="button" className="flex flex-col gap-[5px] p-2" aria-label="Menu">
            <span className="block h-[2.5px] w-6 rounded-full bg-red-600 dark:bg-white/80" />
            <span className="block h-[2.5px] w-6 rounded-full bg-red-600 dark:bg-white/80" />
            <span className="block h-[2.5px] w-6 rounded-full bg-red-600 dark:bg-white/80" />
          </button>
        </div>

        <h1 className="mt-4 max-w-[14ch] font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-[1.1] text-black dark:text-white sm:text-[2rem]">
          What&apos;s your vibe today?
        </h1>
        <p className="mt-3 max-w-[22ch] text-[0.95rem] leading-6 text-gray-500 dark:text-white/70">
          Ask me anything, food, drinks or something to do.
        </p>

        <div className="relative mt-2 min-h-0 w-full max-w-[20rem] flex-1 sm:mt-4">
          <div className="pointer-events-none absolute inset-x-[8%] top-[20%] h-[60%] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.32),transparent_68%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(233,62,62,0.34),transparent_72%)]" />
          <Image
            src="/genie-pic2.png"
            alt="Genie"
            width={420}
            height={680}
            priority
            className="relative z-10 mx-auto h-full w-auto max-w-[85%] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_28px_44px_rgba(0,0,0,0.45)]"
          />
        </div>

        <div className="mt-0 w-full shrink-0">
          <QuickChips
            chips={config.quickChips}
            onSelect={(chip) => onChipSelect(chip.prompt)}
          />
        </div>

        <div className="mt-3 shrink-0 sm:mt-5">
          <GenieOrb
            mode={isSubmitting ? "thinking" : "idle"}
            onClick={onOrbTap}
            disabled={isSubmitting}
            size={78}
          />
        </div>

        <form
          className="mt-3 w-full shrink-0 sm:mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label htmlFor="ask-genie" className="sr-only">
            Ask Genie
          </label>
          <div className="group relative">
            <span className="pointer-events-none absolute inset-0 rounded-full border border-red-300 bg-white shadow-[0_2px_12px_rgba(220,38,38,0.08)] transition group-focus-within:border-red-500 group-focus-within:shadow-[0_0_0_3px_rgba(220,38,38,0.1)] dark:border-[#d75555]/55 dark:bg-[linear-gradient(180deg,rgba(55,8,8,0.62),rgba(32,5,5,0.9))] dark:shadow-[0_0_0_1px_rgba(255,130,130,0.06),0_18px_48px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] dark:group-focus-within:border-[#ff7b7b]/80" />
            <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-red-400 dark:text-white/46">
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
              className="relative z-10 w-full rounded-full bg-transparent py-3.5 pl-12 pr-5 text-base text-gray-900 placeholder:text-red-300 focus:outline-none dark:text-white dark:placeholder:text-white/42"
            />
          </div>
        </form>
      </div>
    </section>
  );
}
