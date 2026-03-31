"use client";

import { type RuntimeQuickChip } from "@/app/lib/genieTypes";

type QuickChipsProps = {
  chips: RuntimeQuickChip[];
  onSelect: (chip: RuntimeQuickChip) => void;
};

export function QuickChips({ chips, onSelect }: QuickChipsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onSelect(chip)}
          className="rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(46,7,7,0.9),rgba(30,6,6,0.75))] px-4 py-2 text-sm font-medium text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-200 hover:border-white/22 hover:text-white"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
