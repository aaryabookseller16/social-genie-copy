"use client";

type BottomNavProps = {
  items: string[];
};

export function BottomNav({ items }: BottomNavProps) {
  return (
    <div className="flex items-center justify-center gap-5 rounded-full border border-white/10 bg-black/20 px-5 py-3 text-xs uppercase tracking-[0.28em] text-white/45 backdrop-blur-xl">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}
