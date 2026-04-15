"use client";

import Image from "next/image";

type GenieOrbMode = "idle" | "listening" | "thinking";

type GenieOrbProps = {
  mode?: GenieOrbMode;
  onClick?: () => void;
  disabled?: boolean;
  size?: number;
  className?: string;
  label?: string;
};

function MicGlyph() {
  return (
    <Image
      src="/icons/micIcon.png"
      alt=""
      aria-hidden="true"
      width={32}
      height={32}
      className="h-7 w-7 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]"
    />
  );
}

function WaveGlyph({ animated }: { animated: boolean }) {
  return (
    <div className="flex items-end justify-center gap-1">
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className={`w-1.5 rounded-full bg-white/95 ${
            animated ? "animate-orbWave" : ""
          }`}
          style={{
            height: `${14 + (index % 2 === 0 ? 8 : 18)}px`,
            animationDelay: `${index * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

export function GenieOrb({
  mode = "idle",
  onClick,
  disabled = false,
  size = 108,
  className = "",
  label = "Speak to Genie",
}: GenieOrbProps) {
  const isButton = typeof onClick === "function";
  const content = (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/Ellipse 120.png"
        alt=""
        fill
        sizes={`${size}px`}
        className={`object-contain ${
          mode === "thinking" ? "animate-orbPulse" : ""
        }`}
        priority
      />
      <span className="relative z-10 flex items-center justify-center">
        {mode === "listening" ? <WaveGlyph animated /> : <MicGlyph />}
      </span>
    </span>
  );

  if (!isButton) {
    return content;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {content}
    </button>
  );
}
