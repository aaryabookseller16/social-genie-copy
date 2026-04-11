"use client";

type BottomNavProps = {
  items: string[];
};

export function BottomNav({ items }: BottomNavProps) {
  return (
    <div className="flex items-center justify-center gap-5 rounded-full border border-gray-200 bg-white px-5 py-3 text-xs uppercase tracking-[0.28em] text-gray-400 shadow-sm dark:border-white/12 dark:bg-[rgba(11,0,0,0.82)] dark:text-white/58">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}
