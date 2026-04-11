"use client";

import { type RuntimeQuickChip } from "@/app/lib/genieTypes";

type QuickChipsProps = {
  chips: RuntimeQuickChip[];
  onSelect: (chip: RuntimeQuickChip) => void;
};

export function QuickChips({ chips, onSelect }: QuickChipsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {chips.map((chip, index) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onSelect(chip)}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition duration-200 ${
            index === 1
              ? "border-red-500 bg-red-500 text-white shadow-sm hover:bg-red-600 dark:border-red-500 dark:bg-red-600"
              : "border-gray-300 bg-white text-gray-700 hover:border-red-400 hover:text-red-600 dark:border-white/12 dark:bg-[linear-gradient(180deg,rgba(46,7,7,0.9),rgba(30,6,6,0.75))] dark:text-white/88 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] dark:hover:border-white/22 dark:hover:text-white"
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
