"use client";
 
import Image from "next/image";
import { useEffect, useState, useRef, useMemo } from "react";
 
const MATCH_DATE = new Date("2026-06-14T19:00:00Z"); // 2pm CT = 7pm UTC
 
function useCountdown() {
  const [t, setT] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = MATCH_DATE.getTime() - Date.now();
      if (diff <= 0) { setT({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setT({
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
  return t;
}
 
const MATCHES = [
  { day: "14", month: "Jun", teams: "Germany vs Cura\u00e7ao", venue: "NRG Stadium · 2:00 PM", badge: "First", key: "jun14" },
  { day: "18", month: "Jun", teams: "Group Stage Match", venue: "NRG Stadium", badge: null, key: "jun18" },
  { day: "22", month: "Jun", teams: "Group Stage Match", venue: "NRG Stadium", badge: null, key: "jun22" },
  { day: "26", month: "Jun", teams: "Group Stage Match", venue: "NRG Stadium", badge: null, key: "jun26" },
  { day: "30", month: "Jun", teams: "Round of 32", venue: "NRG Stadium", badge: null, key: "jun30" },
  { day: "4",  month: "Jul", teams: "Round of 16", venue: "NRG Stadium", badge: null, key: "jul4" },
  { day: "TBD", month: "Jul", teams: "Knockout Round", venue: "NRG Stadium", badge: null, key: "tbd" },
];
 
 
export default function WorldCupPage() {
  const { days, hours, minutes, seconds } = useCountdown();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [genieBase, setGenieBase] = useState("https://genie.socialbevy.com");

useEffect(() => {
  if (window.location.hostname === "localhost") {
    setGenieBase("http://localhost:3000");
  }
}, []);
 
// Pre-filled Genie query URLs — land user directly in results
const GENIE_LINKS = useMemo(() => ({
  watchParties: `${genieBase}/?q=world+cup+watch+party+houston`,
  beforeMatch: `${genieBase}/?q=restaurants+near+NRG+Stadium+houston`,
  afterMatch: `${genieBase}/?q=late+night+bars+houston+after+match`,
  explore: `${genieBase}/?q=best+neighborhoods+houston+nightlife`,
  eado: `${genieBase}/?q=bars+and+restaurants+EaDo+houston`,
  midtown: `${genieBase}/?q=nightlife+midtown+houston`,
  downtown: `${genieBase}/?q=dining+downtown+houston+stadium`,
  montrose: `${genieBase}/?q=bars+food+montrose+houston`,
}), [genieBase]);

const HOODS = [
  { name: "EaDo", sub: "Fan Festival HQ", tags: ["Fan Fest", "Bars"], link: GENIE_LINKS.eado },
  { name: "Midtown", sub: "Nightlife central", tags: ["Nightlife", "Late Night"], link: GENIE_LINKS.midtown },
  { name: "Downtown", sub: "Stadium district", tags: ["Hotels", "Dining"], link: GENIE_LINKS.downtown },
  { name: "Montrose", sub: "Bars & culture", tags: ["Vibes", "Food"], link: GENIE_LINKS.montrose },
];

const planMatchLink = (date: string) => 
  `${genieBase}/?q=watch+party+houston+${date.replace(/\s/g, "+")}`;
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/worldcup/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), first_name: firstName.trim(), city: "Houston", acquisition_source: "worldcup_houston" }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) { setSubmitted(true); }
      else { setError(data.error ?? "Something went wrong."); }
    } catch { setError("Something went wrong. Try again."); }
    finally { setSubmitting(false); }
  };
 
  const handleShare = async () => {
    const url = "https://genie.socialbevy.com/worldcup";
    if (navigator.share) {
      await navigator.share({ title: "Genie × FIFA World Cup 2026 — Houston", text: "Find your perfect World Cup spot in Houston ⚽🏆", url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
 
  const handleCopy = async () => {
    await navigator.clipboard.writeText("https://genie.socialbevy.com/worldcup");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
 
  return (
    <main style={{ minHeight: "100dvh", background: "#060606", color: "#fff", fontFamily: "-apple-system, 'Helvetica Neue', sans-serif", maxWidth: 480, margin: "0 auto" }}>
 
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px 4px", background: "#060606" }}>
        <span style={{ fontSize: 11, fontWeight: 500 }}>9:41</span>
        <div style={{ display: "flex", gap: 4, fontSize: 10 }}>
          <span>●●●</span><span>WiFi</span><span>100%</span>
        </div>
      </div>
 
      {/* Brand bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Image src="/favicon-bevy.png" alt="Social Bevy" width={20} height={20} style={{ borderRadius: "50%" }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: "#858585", letterSpacing: "0.04em", textTransform: "uppercase" }}>Social Bevy × Genie</span>
        </div>
      </div>
 
      {/* Hero */}
      <div style={{ position: "relative", height: 180, background: "linear-gradient(170deg,#1a0000 0%,#060606 100%)", overflow: "hidden", margin: "0 0 0 0" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 60% 40%,rgba(226,30,34,0.2) 0%,transparent 70%)" }} />
        <div style={{ position: "absolute", left: 16, bottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: "#E21E22", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>FIFA World Cup 2026</div>
          <div style={{ fontSize: 26, fontWeight: 500, color: "#fff", lineHeight: 1.1 }}>
            Houston <span style={{ color: "#E21E22" }}>is Ready.</span>
          </div>
          <div style={{ fontSize: 10, color: "#858585", marginTop: 4 }}>Germany vs Cura&ccedil;ao &middot; June 14 &middot; NRG Stadium</div>
        </div>
        <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", opacity: 0.06, fontSize: 80 }}>⚽</div>
        {/* Houston Genie image */}
        <div style={{ position: "absolute", right: 0, bottom: 0, height: 170, width: 120 }}>
          <Image src="/genie-pic2.png" alt="Houston Genie" fill style={{ objectFit: "contain", objectPosition: "bottom right" }} />
        </div>
      </div>
 
      {/* Countdown */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 14 }}>
          {[
            { val: days, label: "Days" },
            { val: hours, label: "Hours" },
            { val: minutes, label: "Min" },
            { val: seconds, label: "Sec" },
          ].map(({ val, label }) => (
            <div key={label} style={{ background: "#111", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: "#fff", lineHeight: 1 }}>{String(val).padStart(2, "0")}</div>
              <div style={{ fontSize: 9, color: "#858585", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
            </div>
          ))}
        </div>
 
        {/* Email capture */}
        {submitted ? (
          <div style={{ background: "#111", border: "1px solid rgba(226,30,34,0.3)", borderRadius: 12, padding: 14, textAlign: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>🏆</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#fff", marginBottom: 4 }}>You&apos;re in!</div>
            <div style={{ fontSize: 11, color: "#858585", marginBottom: 10 }}>Genie&apos;s match-day plan is coming your way.</div>
            <a href={GENIE_LINKS.watchParties} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", background: "#E21E22", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 500, color: "#fff", textDecoration: "none" }}>
              Ask Genie Now ⚽
            </a>
          </div>
        ) : (
          <div style={{ background: "#111", border: "1px solid rgba(226,30,34,0.3)", borderRadius: 12, padding: 12, marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#fff", marginBottom: 2 }}>Get Genie&apos;s match-day plan for Houston</div>
            <div style={{ fontSize: 11, color: "#858585", marginBottom: 10, lineHeight: 1.4 }}>Tell us your vibe — we&apos;ll send you the perfect before, during &amp; after match guide.</div>
            <form onSubmit={(e) => void handleSubmit(e)}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{ flex: 1, background: "#1a1a1a", border: "0.5px solid #333", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#fff", outline: "none" }}
                />
                <button type="submit" disabled={submitting}
                  style={{ background: "#E21E22", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 500, color: "#fff", cursor: "pointer", whiteSpace: "nowrap", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "..." : "Send My Plan"}
                </button>
              </div>
              {error && <div style={{ fontSize: 10, color: "#ff6b6b", marginBottom: 4 }}>{error}</div>}
            </form>
            <div style={{ fontSize: 10, color: "#555", textAlign: "center" }}>No spam. Unsubscribe anytime. Powered by Genie.</div>
          </div>
        )}
      </div>
 
      {/* Ask Genie quick grid */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "#E21E22", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Ask Genie</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { icon: "📺", title: "Watch Parties", sub: "Best spots to watch every match", link: GENIE_LINKS.watchParties, primary: true },
            { icon: "🍽️", title: "Before the Match", sub: "Where to eat near NRG", link: GENIE_LINKS.beforeMatch, primary: false },
            { icon: "🎵", title: "After the Match", sub: "Nightlife & late-night spots", link: GENIE_LINKS.afterMatch, primary: false },
            { icon: "📍", title: "Explore Houston", sub: "Neighborhoods & vibes", link: GENIE_LINKS.explore, primary: false },
          ].map(({ icon, title, sub, link, primary }) => (
            <a key={title} href={link} target="_blank" rel="noopener noreferrer"
              style={{
                background: "#111", borderRadius: 10, padding: 12, cursor: "pointer",
                border: primary ? "0.5px solid rgba(226,30,34,0.35)" : "0.5px solid #1e1e1e",
                textDecoration: "none", display: "block", position: "relative"
              }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#fff", marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 10, color: "#555", lineHeight: 1.3 }}>{sub}</div>
              <div style={{ position: "absolute", right: 10, top: 10, fontSize: 12, color: "#333" }}>›</div>
            </a>
          ))}
        </div>
      </div>
 
      <div style={{ height: "0.5px", background: "#1a1a1a", margin: "0 16px" }} />
 
      {/* Match schedule */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "#E21E22", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>All 7 Houston Matches</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {MATCHES.map((m, i) => (
            <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 10, background: "#111", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ textAlign: "center", minWidth: 36 }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: i === 0 ? "#E21E22" : "#fff", lineHeight: 1 }}>{m.day}</div>
                <div style={{ fontSize: 9, color: "#858585", textTransform: "uppercase" }}>{m.month}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#fff" }}>
                  {m.teams}
                  {m.badge && <span style={{ fontSize: 9, background: "rgba(226,30,34,0.15)", color: "#E21E22", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>{m.badge}</span>}
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>{m.venue}</div>
              </div>
              <a href={planMatchLink(m.month + " " + m.day)} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 10, color: "#E21E22", border: "0.5px solid rgba(226,30,34,0.4)", borderRadius: 6, padding: "4px 8px", whiteSpace: "nowrap", textDecoration: "none" }}>
                Plan It
              </a>
            </div>
          ))}
        </div>
      </div>
 
      <div style={{ height: "0.5px", background: "#1a1a1a", margin: "0 16px" }} />
 
      {/* Neighborhoods */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "#E21E22", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Houston Neighborhoods</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {HOODS.map(h => (
            <a key={h.name} href={h.link} target="_blank" rel="noopener noreferrer"
              style={{ background: "#111", borderRadius: 10, padding: "10px 12px", cursor: "pointer", textDecoration: "none", display: "block" }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#fff", marginBottom: 2 }}>{h.name}</div>
              <div style={{ fontSize: 10, color: "#858585", marginTop: 1 }}>{h.sub}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                {h.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 9, color: "#858585", background: "#1a1a1a", borderRadius: 4, padding: "2px 6px" }}>{tag}</span>
                ))}
              </div>
            </a>
          ))}
        </div>
      </div>
 
      <div style={{ height: "0.5px", background: "#1a1a1a", margin: "0 16px" }} />
 
      {/* Stats bar */}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-around", background: "#111", borderRadius: 10, padding: 10 }}>
          {[
            { num: "660+", label: "Houston venues" },
            { num: "7", label: "Match days" },
            { num: "AI", label: "Powered by Genie" },
          ].map(({ num, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#fff" }}>{num}</div>
              <div style={{ fontSize: 9, color: "#555", marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
 
      {/* Share section */}
      <div style={{ padding: "14px 16px 32px" }}>
        <div style={{ background: "#111", borderRadius: 12, padding: 14, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#fff", marginBottom: 4 }}>Send this to your crew before you land</div>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>Share Houston&apos;s social guide for the World Cup</div>
          <div style={{ background: "#1a1a1a", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#858585", marginBottom: 10, letterSpacing: "0.01em" }}>
            genie.socialbevy.com/worldcup
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button onClick={() => void handleCopy()}
              style={{ background: "#1a1a1a", border: "0.5px solid #333", borderRadius: 8, padding: 8, fontSize: 11, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              📋 {copied ? "Copied!" : "Copy Link"}
            </button>
            <button onClick={() => void handleShare()}
              style={{ background: "#E21E22", border: "none", borderRadius: 8, padding: 8, fontSize: 11, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              ↑ Share
            </button>
          </div>
        </div>
      </div>
 
      {/* Bottom nav */}
      <div style={{ position: "sticky", bottom: 0, display: "flex", justifyContent: "space-around", padding: "10px 0 20px", background: "#0d0d0d", borderTop: "0.5px solid #1a1a1a" }}>
        {[
          { icon: "🌍", label: "World Cup", active: true, href: "/worldcup" },
          { icon: "💬", label: "Ask Genie", active: false, href: GENIE_LINKS.watchParties },
          { icon: "🗺️", label: "Map", active: false, href: GENIE_LINKS.explore },
          { icon: "👤", label: "Profile", active: false, href: "https://genie.socialbevy.com" },
        ].map(({ icon, label, active, href }) => (
          <a key={label} href={href} target={active ? "_self" : "_blank"} rel="noopener noreferrer"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", textDecoration: "none" }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontSize: 9, color: active ? "#E21E22" : "#555" }}>{label}</span>
          </a>
        ))}
      </div>
 
    </main>
  );
}
 