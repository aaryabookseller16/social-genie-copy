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
          className={`rounded-full border bg-transparent px-4 py-2 text-sm font-medium transition duration-200 ${
            index === 1
              ? "border-red-500 text-red-600 hover:border-red-400 dark:border-red-400 dark:text-red-300 dark:hover:border-red-300"
              : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-white/40 dark:text-white/90 dark:hover:border-white/70 dark:hover:text-white"
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
