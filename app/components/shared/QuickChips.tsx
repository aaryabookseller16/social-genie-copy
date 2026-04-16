"use client";

import { type RuntimeQuickChip } from "@/app/lib/genieTypes";

type QuickChipsProps = {
  chips: RuntimeQuickChip[];
  onSelect: (chip: RuntimeQuickChip) => void;
};

export function QuickChips({ chips, onSelect }: QuickChipsProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelect(chip)}
            className="whitespace-nowrap rounded-full border bg-transparent px-3 py-1.5 text-xs font-medium transition duration-200 sm:px-4 sm:py-2 sm:text-sm border-[#E70703]/60 text-[#E70703] hover:border-[#E70703] dark:border-white/40 dark:text-white/90 dark:hover:border-white/70 dark:hover:text-white"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
