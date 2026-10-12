"use client";

import { useId, useState } from "react";

import { saveQuickPicks } from "@/app/lib/publicApiClient";
import { QUICK_PICK_CARDS, preferencesForCards } from "@/app/lib/quickPicks";

type QuickPickOnboardingProps = {
  // Called after the result is saved (or skipped) so the parent can hide this.
  onDone: (status: "completed" | "skipped") => void;
};

/**
 * First-run quick-pick cards shown in Genie's greeting (GEN-012).
 * Picks are saved as stated preferences; skipping is always allowed.
 */
export function QuickPickOnboarding({ onDone }: QuickPickOnboardingProps) {
  const headingId = useId();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (cardId: string) => {
    setSelected((previous) =>
      previous.includes(cardId)
        ? previous.filter((id) => id !== cardId)
        : [...previous, cardId]
    );
  };

  const finish = async (status: "completed" | "skipped") => {
    setSaving(true);
    setError(null);
    const cardIds = status === "completed" ? selected : [];
    try {
      await saveQuickPicks({
        status,
        cardIds,
        picks: preferencesForCards(cardIds),
      });
      onDone(status);
    } catch {
      setError("Couldn't save that. Try again, or skip for now.");
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="w-full rounded-[20px] border border-gray-100 bg-white/90 px-3 py-3 text-left shadow-[0_6px_18px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-black/40"
    >
      <h2
        id={headingId}
        className="text-center text-[1rem] font-semibold text-gray-900 dark:text-white"
      >
        Which of these sounds like a good night?
      </h2>
      <p className="mt-0.5 text-center text-[12px] text-gray-500 dark:text-white/65">
        Pick any that fit. Genie will use them to start your suggestions.
      </p>

      <div role="group" aria-labelledby={headingId} className="mt-3 grid grid-cols-2 gap-2">
        {QUICK_PICK_CARDS.map((card) => {
          const isSelected = selected.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={isSelected}
              disabled={saving}
              onClick={() => toggle(card.id)}
              className={`min-h-[44px] rounded-[14px] border px-2 py-2 text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 disabled:opacity-60 ${
                isSelected
                  ? "border-red-500 bg-red-600 text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                  : "border-gray-300 bg-transparent text-gray-800 hover:border-red-300 dark:border-white/25 dark:text-white/90 dark:hover:border-white/55"
              }`}
            >
              {card.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-center text-[12px] text-red-600 dark:text-[#ff7b7b]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void finish("skipped")}
          className="flex-1 rounded-full border border-gray-300 bg-transparent py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60 dark:border-white/30 dark:text-white/90 dark:hover:bg-white/10"
        >
          Skip
        </button>
        <button
          type="button"
          disabled={saving || selected.length === 0}
          onClick={() => void finish("completed")}
          className="flex-1 rounded-full border border-red-500 bg-red-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
        >
          {saving ? "Saving..." : selected.length > 0 ? `Done (${selected.length})` : "Done"}
        </button>
      </div>
    </section>
  );
}
