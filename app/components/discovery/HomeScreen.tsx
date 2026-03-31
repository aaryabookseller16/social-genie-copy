"use client";

import Image from "next/image";

import { BottomNav } from "@/app/components/shared/BottomNav";
import { GenieOrb } from "@/app/components/shared/GenieOrb";
import { QuickChips } from "@/app/components/shared/QuickChips";
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
  showBottomNav = true,
  onInputChange,
  onChipSelect,
  onOrbTap,
  onSubmit,
}: HomeScreenProps) {
  return (
    <section className="relative flex flex-1 flex-col overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(20,0,0,0.96),rgba(42,4,4,0.92)_52%,rgba(15,0,0,0.98))] px-5 pb-4 pt-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:px-7 sm:pb-6 sm:pt-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(186,24,27,0.45),transparent_34%),radial-gradient(circle_at_50%_58%,rgba(160,18,18,0.22),transparent_44%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen [background-image:radial-gradient(rgba(255,255,255,0.06)_0.8px,transparent_0.8px)] [background-position:0_0] [background-size:18px_18px]" />

      <div className="relative mx-auto flex max-w-sm flex-1 flex-col items-center text-center">
        <p className="mb-1 text-[0.68rem] uppercase tracking-[0.48em] text-white/38">
          Social Genie
        </p>
        <h1 className="max-w-[12ch] font-[family:var(--font-display)] text-3xl font-semibold leading-[0.95] text-white sm:text-4xl">
          What&apos;s your vibe today?
        </h1>
        <p className="mt-2 max-w-[18ch] text-sm leading-5 text-white/74 sm:text-base sm:leading-6">
          Ask me anything, food, drinks or something to do.
        </p>

        <div className="relative mt-3 min-h-0 w-full max-w-[23rem] flex-1 sm:mt-5">
          <div className="pointer-events-none absolute inset-x-[12%] top-[18%] h-[62%] rounded-full bg-[radial-gradient(circle,rgba(233,62,62,0.34),transparent_72%)] blur-3xl" />
          <Image
            src="/genie-pic2.png"
            alt="Genie"
            width={420}
            height={680}
            priority
            className="relative z-10 mx-auto h-full w-auto max-w-[85%] object-contain drop-shadow-[0_28px_44px_rgba(0,0,0,0.45)]"
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
            size={88}
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
            <span className="pointer-events-none absolute inset-0 rounded-full border border-[#d75555]/55 bg-[linear-gradient(180deg,rgba(55,8,8,0.62),rgba(32,5,5,0.9))] shadow-[0_0_0_1px_rgba(255,130,130,0.06),0_18px_48px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] transition group-focus-within:border-[#ff7b7b]/80 group-focus-within:shadow-[0_0_0_1px_rgba(255,130,130,0.08),0_0_0_4px_rgba(198,34,34,0.18),0_18px_48px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)]" />
            <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white/46">
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
              placeholder="Ask Genie..."
              autoComplete="off"
              className="relative z-10 w-full rounded-full bg-transparent py-4 pl-12 pr-5 text-lg text-white placeholder:text-white/42 focus:outline-none"
            />
          </div>
        </form>

        {showBottomNav ? (
          <div className="mt-7 opacity-70">
            <BottomNav items={["Home", "Genie", "Search"]} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
