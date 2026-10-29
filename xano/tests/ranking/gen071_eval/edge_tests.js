// Edge cases: the ranker must never throw and must keep its contract.
const fs = require("fs"), path = require("path");
eval(fs.readFileSync(path.join(__dirname, "ranker_core.js"), "utf8"));
const rows = JSON.parse(fs.readFileSync(process.env.VENUES || path.join(__dirname, "venues.json"), "utf8")).filter((r) => r.city_id === 1 && r.status === "active");
const clock = { dow: 0, minute: 30 };
let fails = 0;
function t(name, args, expect) {
  try {
    const r = rank(Object.assign({ clock }, args), rows);
    const sums = r.top.every((v) => Math.abs(Object.values(v.breakdown).reduce((s, x) => s + x, 0) - v.score) < 0.06);
    const msg = expect ? expect(r) : true;
    const ok = sums && msg === true && r.top.length <= 10;
    if (!ok) fails++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}: top=${r.top.length} pool=${r.pool_count} quality=${r.match_quality} relaxed=[${r.relaxed}] ${sums ? "" : "BREAKDOWN-MISMATCH "}${msg === true ? "" : msg}`);
  } catch (e) { fails++; console.log(`FAIL ${name}: threw ${e.stack}`); }
}
t("no filters", {});
t("empty rows", {}, () => true);
try { const r = rank({ clock }, []); console.log(r.match_quality === "empty" ? "ok   zero rows -> empty" : "FAIL zero rows"); } catch (e) { fails++; console.log("FAIL zero rows threw", e.message); }
t("null-ish inputs", { venue_type: null, cuisine: null, keywords: null, preference_keywords: "x", avoid_keywords: 5, limit: "abc", exclude_ids: null });
t("limit 3", { limit: 3 }, (r) => r.top.length === 3 || "len " + r.top.length);
t("limit 99 capped", { limit: 99 }, (r) => r.top.length === 10 || "len " + r.top.length);
t("geo midtown 2.5km", { lat: 29.7426, lng: -95.377, radius_m: 2500, venue_type: "bar" }, (r) => r.top.every((v) => v.km !== null && v.km <= 2.5) || "outside radius");
t("geo tiny radius relaxes", { lat: 29.7426, lng: -95.377, radius_m: 50, keywords: ["karaoke"] }, (r) => r.relaxed.includes("radius_x2") || "no relax");
t("open now", { open_now: true }, (r) => r.top.every((v) => v.open_now === true) || r.relaxed.includes("open_now") || "closed venue");
t("exclude ids", { venue_type: "bar", exclude_ids: [541, 614, 870] , keywords: ["rooftop"]}, (r) => !r.top.some((v) => [541, 614, 870].includes(v.id)) || "excluded shown");
t("rain", { avoid_outdoor: true, venue_type: "bar" }, (r) => true);
t("rain but asked patio", { avoid_outdoor: true, keywords: ["patio"] }, (r) => !r.top.some((v) => v.breakdown.rain) || "rain penalty applied");
t("sort by rating", { sort_by: "rating", venue_type: "bar" });
t("unknown cuisine", { cuisine: "ethiopian" }, (r) => r.relaxed.includes("cuisine") || r.pool_count >= 3 || "no relax");
t("everything", { venue_type: "restaurant", cuisine: "steak", neighborhood: "the heights", price_band: "$$$", meal_service: "late_night", open_now: true, keywords: ["romantic", "patio", "wine"], energy: "Chill", preference_keywords: ["rooftop", "chill & intimate"], avoid_keywords: ["loud & lit"], lat: 29.79, lng: -95.39, radius_m: 3000 });
t("strip asked", { keywords: ["strip club"] }, (r) => true);
console.log(fails ? `\n${fails} FAILED` : "\nall edge tests passed");
