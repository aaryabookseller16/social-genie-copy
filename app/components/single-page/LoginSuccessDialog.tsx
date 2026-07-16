"use client";

import { useEffect } from "react";

type LoginSuccessDialogProps = {
  visible: boolean;
  onClose: () => void;
};

export function LoginSuccessDialog({ visible, onClose }: LoginSuccessDialogProps) {
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label="Logged In"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 overflow-hidden rounded-t-[28px] bg-black bg-[url('/bg.png')] bg-cover bg-center shadow-[0_-12px_60px_rgba(0,0,0,0.7)]">
        {/* Dark overlay for readability */}
        <div className="pointer-events-none absolute inset-0 bg-black/55" />

        <div className="relative px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)] pt-4">
          {/* Handle */}
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/25" />

          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[1.6rem] font-bold leading-tight text-white">
              You&apos;re logged in
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Confirmation copy */}
          <p className="mb-6 text-[0.95rem] leading-relaxed text-white/80">
            You have logged in successfully.
          </p>

          {/* Continue button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[18px] border border-red-500/60 bg-[linear-gradient(180deg,rgba(180,20,20,0.92),rgba(100,5,5,0.98))] px-4 py-4 text-center text-[1.1rem] font-bold text-white shadow-[0_0_0_1px_rgba(255,80,80,0.15),0_8px_24px_rgba(0,0,0,0.4)] transition hover:brightness-110 active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
