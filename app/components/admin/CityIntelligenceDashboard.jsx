"use client";

import { useState, useEffect } from "react";
 
const XANO_BASE = "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e";
 
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: "24px 28px",
      position: "relative",
      overflow: "hidden"
    }}>
      {accent && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: accent
        }} />
      )}
      <div style={{ fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 42, fontWeight: 700, color: "#fff", lineHeight: 1, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
 
function BarChart({ data, maxVal }) {
  if (!data || data.length === 0) return (
    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "20px 0" }}>No data available</div>
  );
  const max = maxVal || Math.max(...data.map(d => d.query_count || 0)) || 1;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, padding: "0 0 0 0" }}>
      {data.map((d, i) => {
        const h = Math.max(4, ((d.query_count || 0) / max) * 120);
        const hr = Math.max(0, ((d.queries_with_results || 0) / max) * 120);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, position: "relative" }}>
            <div style={{ width: "100%", position: "relative", height: h }}>
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: h, background: "rgba(255,255,255,0.1)", borderRadius: "4px 4px 0 0"
              }} />
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: hr, background: "linear-gradient(180deg, #E8C547, #C9A522)", borderRadius: "4px 4px 0 0"
              }} />
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", transform: "rotate(-45deg)", transformOrigin: "top center", whiteSpace: "nowrap", marginTop: 8 }}>
              {d.date ? d.date.slice(5) : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
 
function CategoryRow({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>
          {label.replace(/_/g, " ")}
        </span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{count} · {pct}%</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
        <div style={{ height: 4, width: `${pct}%`, background: color || "#C9A522", borderRadius: 2, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}
 
export default function CityIntelligenceDashboard() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [city, setCity] = useState("Houston");
  const [days, setDays] = useState(30);
  const [wcOnly, setWcOnly] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
 
  const fetchReport = async () => {
  setLoading(true);
  setError(null);
  try {
    const params = new URLSearchParams({ city, days_back: String(days), worldcup_only: String(wcOnly) });
    const res = await fetch(`/api/admin/city-intelligence?${params}`);
    const data = await res.json();
    console.log("Dashboard response:", JSON.stringify(data));
    if (data.success) {
      setReport(data.report);
      setLastRefresh(new Date().toLocaleTimeString());
    } else {
      setError("Endpoint returned no data.");
    }
  } catch (e) {
    console.error("Dashboard fetch error:", e);
    setError("Could not reach Genie API.");
  } finally {
    setLoading(false);
  }
};
 
  useEffect(() => { fetchReport(); }, []);
 
  const s = report?.summary;
  const daily = report?.daily_volume || [];
  const cats = report?.category_breakdown || [];
  const langs = report?.language_breakdown || [];
 
  // Count totals from breakdown arrays since agent returned nulls
  const catTotal = cats.reduce((acc, c) => acc + (c.count || 0), 0);
  const langTotal = langs.reduce((acc, l) => acc + (l.count || 0), 0);
 
  const catColors = ["#C9A522", "#E8C547", "#4A90D9", "#7B68EE", "#50C878", "#FF6B6B"];
 
  return (
    <div style={{
      minHeight: "100vh",
      background: "#080C14",
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      color: "#fff",
      padding: "0"
    }}>
 
      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "24px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255,255,255,0.02)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, #C9A522, #E8C547)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16
          }}>⚡</div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
              Social Bevy · Genie
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
              City Intelligence Dashboard
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastRefresh && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              Updated {lastRefresh}
            </div>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "8px 14px",
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>City</span>
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              style={{ background: "transparent", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", outline: "none" }}
            >
              <option value="Houston" style={{ background: "#111" }}>Houston</option>
              <option value="Dallas" style={{ background: "#111" }}>Dallas</option>
              <option value="Austin" style={{ background: "#111" }}>Austin</option>
              <option value="Atlanta" style={{ background: "#111" }}>Atlanta</option>
              <option value="Miami" style={{ background: "#111" }}>Miami</option>
            </select>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "8px 14px",
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              style={{ background: "transparent", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", outline: "none" }}
            >
              <option value={7} style={{ background: "#111" }}>7 days</option>
              <option value={14} style={{ background: "#111" }}>14 days</option>
              <option value={30} style={{ background: "#111" }}>30 days</option>
              <option value={60} style={{ background: "#111" }}>60 days</option>
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            <input type="checkbox" checked={wcOnly} onChange={e => setWcOnly(e.target.checked)} style={{ accentColor: "#C9A522" }} />
            World Cup only
          </label>
          <button
            onClick={fetchReport}
            style={{
              background: "linear-gradient(135deg, #C9A522, #E8C547)",
              border: "none", borderRadius: 10, padding: "9px 20px",
              color: "#080C14", fontWeight: 700, fontSize: 13, cursor: "pointer"
            }}
          >
            Refresh
          </button>
        </div>
      </div>
 
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, flexDirection: "column", gap: 16 }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #C9A522", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading city intelligence…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
 
      {error && (
        <div style={{ padding: 40, textAlign: "center", color: "#FF6B6B", fontSize: 14 }}>{error}</div>
      )}
 
      {!loading && !error && s && (
        <div style={{ padding: "32px 40px" }}>
 
          {/* Period banner */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 28, padding: "14px 20px",
            background: "rgba(201,165,34,0.08)", borderRadius: 12,
            border: "1px solid rgba(201,165,34,0.2)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#C9A522", boxShadow: "0 0 8px #C9A522" }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                <strong style={{ color: "#fff" }}>{s.city}</strong> · {s.date_from} to {s.date_to} · {s.period_days} day window
              </span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Live Intelligence Report
            </div>
          </div>
 
          {/* Key metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            <StatCard
              label="Total Queries"
              value={s.total_queries.toLocaleString()}
              sub={`Last ${s.period_days} days`}
              accent="linear-gradient(90deg, #C9A522, #E8C547)"
            />
            <StatCard
              label="Unique Users"
              value={s.total_unique_users.toLocaleString()}
              sub="Active social seekers"
              accent="linear-gradient(90deg, #4A90D9, #7BB3F0)"
            />
            <StatCard
              label="Result Rate"
              value={`${s.result_rate_pct}%`}
              sub={`${s.queries_with_results} queries with venue results`}
              accent="linear-gradient(90deg, #50C878, #7BE8A0)"
            />
            <StatCard
              label="Avg Venues / Query"
              value={s.avg_venues_per_query}
              sub="Venue cards served per search"
              accent="linear-gradient(90deg, #7B68EE, #A89BF5)"
            />
          </div>
 
          {/* Secondary metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
            <StatCard
              label="World Cup Queries"
              value={s.worldcup_queries.toLocaleString()}
              sub="Tournament window activity"
              accent="linear-gradient(90deg, #1a3a8f, #2952cc)"
            />
            <StatCard
              label="International Visitors"
              value={s.international_visitor_queries.toLocaleString()}
              sub="Non-English language queries"
              accent="linear-gradient(90deg, #FF6B6B, #FF9B9B)"
            />
            <StatCard
              label="Queries w/ Results"
              value={s.queries_with_results.toLocaleString()}
              sub="Successful venue discoveries"
              accent="linear-gradient(90deg, #C9A522, #50C878)"
            />
          </div>
 
          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
 
            {/* Daily volume chart */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "24px 28px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
                    Daily Query Volume
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Social Activity Timeline</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} />
                    Total
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: "#C9A522" }} />
                    With Results
                  </div>
                </div>
              </div>
              <BarChart data={[...daily].reverse()} />
            </div>
 
            {/* Category breakdown */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "24px 28px"
            }}>
              <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
                Query Categories
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>What Houstonians Search</div>
              {cats.length > 0 ? cats.map((c, i) => (
                <CategoryRow
                  key={i}
                  label={c.category}
                  count={c.count || 0}
                  total={catTotal || s.total_queries}
                  color={catColors[i % catColors.length]}
                />
              )) : (
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Count data pending — check aggregation logic</div>
              )}
            </div>
          </div>
 
          {/* Language breakdown */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: "24px 28px"
          }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
              Language Intelligence
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Visitor Origin Signals</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {langs.map((l, i) => (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "16px 20px",
                  border: "1px solid rgba(255,255,255,0.06)"
                }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>
                    {l.language === "english" || l.language === "en" ? "🇺🇸" :
                     l.language === "portuguese" ? "🇧🇷" :
                     l.language === "spanish" ? "🇲🇽" :
                     l.language === "french" ? "🇫🇷" :
                     l.language === "german" ? "🇩🇪" : "🌍"}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{l.language}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                    {l.count || 0} queries
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Neighborhood breakdown */}
{report?.neighborhood_breakdown && report.neighborhood_breakdown.length > 0 && (
  <div style={{
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16, padding: "24px 28px", marginTop: 20
  }}>
    <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
      Neighborhood Activity
    </div>
    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Where People Are Searching</div>
    {report.neighborhood_breakdown.map((n, i) => (
      <CategoryRow
        key={i}
        label={n.neighborhood}
        count={n.count}
        total={s.total_queries}
        color={catColors[i % catColors.length]}
      />
    ))}
  </div>
)}
 
          {/* Footer */}
          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
              Social Bevy, Inc. · Genie Platform · City Intelligence Layer · Confidential
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
              Generated {new Date(s.generated_at || Date.now()).toLocaleDateString()}
            </div>
          </div>
 
        </div>
      )}
    </div>
  );
}