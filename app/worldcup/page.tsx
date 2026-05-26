"use client";
 
import Image from "next/image";
import { useEffect, useState } from "react";
 
const MATCH_DATE = new Date("2026-06-14T21:00:00Z");
 
function useCountdown() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
 
  useEffect(() => {
    const tick = () => {
      const diff = MATCH_DATE.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
 
  return timeLeft;
}
 
export default function WorldCupPage() {
  const { days, hours, minutes, seconds } = useCountdown();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/worldcup/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          first_name: firstName.trim(),
          city: "Houston",
          acquisition_source: "worldcup_houston",
        }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error ?? "Something went wrong.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };
 
  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Genie x FIFA World Cup 2026 — Houston",
        text: "Find your perfect World Cup watch party in Houston with Genie 🏆⚽",
        url: "https://genie.socialbevy.com/worldcup",
      });
    } else {
      await navigator.clipboard.writeText("https://genie.socialbevy.com/worldcup");
      alert("Link copied!");
    }
  };
 
  const WATCH_PARTY_URL = "https://genie.socialbevy.com/?q=world+cup+watch+party+houston";
 
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0a0f1e] text-white">
 
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a3a8f22_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#c9a52222_0%,_transparent_60%)]" />
      </div>
 
      <div className="relative z-10 mx-auto max-w-md px-4 pb-16 pt-8">
 
        {/* Logo + brand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/favicon-bevy.png" alt="Social Bevy" width={32} height={32} className="rounded-full" />
            <span className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-white/60">
              Social Bevy × Genie
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[0.72rem] font-semibold text-white/80 transition hover:bg-white/15"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </button>
        </div>
 
        {/* Hero */}
        <div className="relative mt-6 flex flex-col items-center text-center">
          <div className="relative h-[320px] w-[260px]">
            <Image
              src="/Houston_Genie_Image.png"
              alt="Houston World Cup Genie"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="-mt-4 space-y-1">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.3em] text-[#c9a522]">
              FIFA World Cup 2026
            </p>
            <h1 className="text-[2.6rem] font-bold leading-tight text-white">
              Houston<br />is Ready.
            </h1>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-white/65">
              Germany vs Cura&ccedil;ao &middot; June 14, 2026<br />
              NRG Stadium &middot; Houston, Texas
            </p>
          </div>
        </div>
 
        {/* Countdown */}
        <div className="mt-8 rounded-[24px] border border-[#c9a522]/30 bg-[#c9a522]/10 p-5">
          <p className="mb-4 text-center text-[0.7rem] font-bold uppercase tracking-[0.25em] text-[#c9a522]">
            Kickoff Countdown
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: days, label: "Days" },
              { value: hours, label: "Hours" },
              { value: minutes, label: "Min" },
              { value: seconds, label: "Sec" },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center rounded-[16px] border border-white/10 bg-white/5 py-3">
                <span className="text-[2.2rem] font-bold leading-none text-white tabular-nums">
                  {String(value).padStart(2, "0")}
                </span>
                <span className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-white/45">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
 
        {/* Find Watch Party CTA */}
        <div className="mt-6">
          <a
            href={WATCH_PARTY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#1a3a8f] py-4 text-[1rem] font-bold text-white transition hover:opacity-90"
          >
            <span>⚽</span>
            Find a Watch Party
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
          <p className="mt-2 text-center text-[0.72rem] text-white/40">
            Powered by Genie &mdash; your AI social concierge
          </p>
        </div>
 
        {/* Divider */}
        <div className="mt-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/35">
            Stay in the loop
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
 
        {/* Email capture */}
        <div className="mt-6">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 rounded-[20px] border border-[#c9a522]/30 bg-[#c9a522]/10 px-5 py-8 text-center">
              <span className="text-[2.5rem]">🏆</span>
              <p className="text-[1.4rem] font-bold text-white">
                You&apos;re in!
              </p>
              <p className="text-[0.85rem] leading-relaxed text-white/65">
                Genie will find your perfect World Cup spot in Houston. Stay tuned.
              </p>
              <a
                href={WATCH_PARTY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 rounded-full border border-[#c9a522] bg-[#c9a522]/20 px-6 py-2.5 text-[0.85rem] font-bold text-[#c9a522] transition hover:bg-[#c9a522]/30"
              >
                Ask Genie Now ⚽
              </a>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
              <p className="text-center text-[0.88rem] leading-relaxed text-white/70">
                Get Genie&apos;s top Houston watch party picks delivered before June 14.
              </p>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name (optional)"
                style={{ fontSize: "16px" }}
                className="w-full rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-white/35 focus:border-[#c9a522]/60 focus:outline-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                style={{ fontSize: "16px" }}
                className="w-full rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-white/35 focus:border-[#c9a522]/60 focus:outline-none"
              />
              {error ? (
                <p className="text-center text-[0.78rem] text-red-400">{error}</p>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-[14px] bg-[#c9a522] py-3.5 text-[0.95rem] font-bold text-[#0a0f1e] transition hover:bg-[#d4af37] disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Get My Watch Party Picks 🏆"}
              </button>
              <p className="text-center text-[0.68rem] text-white/30">
                No spam. Just Genie&apos;s best picks for the World Cup.
              </p>
            </form>
          )}
        </div>
 
        {/* Bottom share */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-[0.82rem] font-semibold text-white/75 transition hover:bg-white/15"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share with your crew
          </button>
          <p className="text-[0.68rem] text-white/30">
            genie.socialbevy.com/worldcup
          </p>
        </div>
 
      </div>
    </main>
  );
}
 