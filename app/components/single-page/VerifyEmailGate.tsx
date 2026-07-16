"use client";

export function VerifyEmailGate({
  visible,
  email,
  onClose,
}: {
  visible: boolean;
  email: string;
  onClose: () => void;
}) {
  void email;

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[24px] border-t border-red-500/30 bg-[radial-gradient(circle_at_top,rgba(140,15,15,0.55),rgba(20,4,4,0.98))] px-6 pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] pt-3 shadow-xl sm:rounded-[24px] sm:border sm:pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto h-1 w-14 rounded-full bg-white/25 sm:hidden" />

        <h2 className="mt-6 text-center text-[1.4rem] font-semibold leading-tight text-white sm:mt-0 sm:text-left sm:text-[1.5rem]">
          Verify your email
        </h2>
        <p className="mt-4 text-center text-[15px] leading-relaxed text-white/75 sm:text-left">
          A link has been sent to your email address! Please use that link to
          login by confirming your email.
        </p>
      </div>
    </div>
  );
}
