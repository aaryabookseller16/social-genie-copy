// Offline eval: new ranker vs a replica of the live search, on the tamu_capstone venue export.
// Usage: node eval_ranker.js [caseId]
const fs = require("fs");
const path = require("path");
const here = __dirname;
eval(fs.readFileSync(path.join(here, "ranker_core.js"), "utf8")); // defines rank()

const all = JSON.parse(fs.readFileSync(process.env.VENUES || path.join(here, "venues.json"), "utf8"));
const rows = all.filter((r) => r.city_id === 1 && r.status === "active"
  && !["CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"].includes(r.google_business_status)
  && !r.is_permanently_closed && !r.is_temporarily_closed);
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
const clock = { dow: 5, minute: 21 * 60 }; // Friday 9 PM Central

// ---- Replica of the live fn_genie_search_venues_dev (2192, Oct 23) scoring, for comparison ----
function liveRank(a) {
  const allowed = ["bar", "restaurant", "night_club", "cafe", "bakery", "food", "meal_takeaway", "meal_delivery"];
  const block = ["vape", "smoke shop", "dispensary", "party supply", "party house", "supply", "events", "event center", "wedding"];
  const hosp = ["lounge", "loung", "bar", "grill", "cantina", "tavern", "pub", "kitchen", "cigar", "hookah", "hooka", "club", "cafe", "coffee", "restaurant", "bistro", "brewery", "taproom", "cocktail", "eatery", "diner"];
  const typeMap = { bar: ["bar"], restaurant: ["restaurant"], club: ["night_club"], cafe: ["cafe", "bakery"] };
  const kws = (a.keywords || []).map((k) => k.toLowerCase());
  const cands = [];
  for (const r of rows) {
    const gt = Array.isArray(r.google_types) ? r.google_types : [], tags = Array.isArray(r.cuisine_tags) ? r.cuisine_tags : [], name = (r.venue_name || "").toLowerCase().trim(), vibe = (r.vibe_notes || "").trim(), rating = +r.google_rating || 0;
    if (!name || gt.includes("lodging") || block.some((b) => name.includes(b)) || (rating <= 0 && !vibe && !tags.length)
      || (!gt.some((t) => allowed.includes(t)) && !hosp.some((h) => name.includes(h)) && !vibe)) continue;
    const ok = {
      venue_type: !a.venue_type || (typeMap[a.venue_type] || [a.venue_type]).some((t) => gt.includes(t)),
      cuisine: !a.cuisine || tags.includes(a.cuisine.replace(/ /g, "_")) || name.includes(a.cuisine) || vibe.toLowerCase().includes(a.cuisine),
      neighborhood: !a.neighborhood || ((r.area_neighborhood || "") + "|" + (r.neighborhood_text || "") + "|" + (r.address || "")).toLowerCase().includes(a.neighborhood.toLowerCase()),
      price_band: !a.price_band || r.price_band === a.price_band,
      meal_service: !a.meal_service || (a.meal_service === "brunch" ? tags.includes("brunch") : a.meal_service === "happy_hour" ? r.ms_happy_hour === true : a.meal_service === "late_night" ? r.ms_late_night === true : true),
    };
    const n = +r.google_user_ratings_total || 0;
    const bayes = rating > 0 ? (rating * n + 4.3 * 25) / (n + 25) : 0;
    let s = bayes > 3.5 ? 6 * (bayes - 3.5) : 0;
    if (vibe) s += 1; if (r.energy_level) s += 0.3; if (r.hours_json && Array.isArray(r.hours_json.periods)) s += 0.3; if (r.image_primary_url) s += 0.2;
    if (kws.length) { const hay = (vibe + " " + (r.crowd || "") + " " + (r.music || "") + " " + name + " " + tags.join(" ")).toLowerCase(); const h = kws.filter((k) => hay.includes(k)).length; s += Math.min(3, h) * 3; }
    if (a.energy && (r.energy_level || "").toLowerCase() === a.energy.toLowerCase()) s += 2;
    cands.push({ id: r.id, ok, s });
  }
  const req = ["venue_type", "cuisine", "neighborhood", "price_band", "meal_service"].filter((k) => a[k]);
  const relaxed = [];
  const keep = (c) => req.every((k) => relaxed.includes(k) || c.ok[k]);
  let pool = cands.filter(keep);
  for (const st of ["meal_service", "open_now", "price_band", "neighborhood", "cuisine", "venue_type"]) {
    if (pool.length < 3 && req.includes(st)) { relaxed.push(st); pool = cands.filter(keep); }
  }
  return pool.sort((x, y) => y.s - x.s).slice(0, 10).map((c) => c.id);
}

// ---- Labelled cases. Filters are what fn_genie_extract_search_filters_dev returns for the message. ----
// good: venues that clearly fit (hand-picked from the venue data). must_top: must be in the top N.
// relevant(r): rule for "this venue fits" used for precision@10. bad: must never appear.
const nameHas = (re) => (r) => re.test((r.venue_name || "") + " " + (r.vibe_notes || ""));
const cases = [
  { id: "rooftop_midtown", msg: "rooftop bar in Midtown", f: { venue_type: "bar", neighborhood: "Midtown", keywords: ["rooftop"] },
    must_top: [[541, 10], [614, 10]], bad: [1052, 1053] },
  { id: "rooftop", msg: "rooftop bars", f: { venue_type: "bar", keywords: ["rooftop"] },
    must_top: [[541, 3], [614, 3], [870, 5]], relevant: nameHas(/rooftop|roof deck/i), bad: [1052, 1053] },
  { id: "sports_bar", msg: "sports bar to watch the game", f: { venue_type: "bar", keywords: ["sports", "watch the game"] },
    relevant: nameHas(/sports|tailgate|twin peaks|watch the game|game day/i), min_relevant: 8 },
  { id: "jazz", msg: "live jazz bar", f: { venue_type: "bar", keywords: ["live jazz"] },
    good: [437, 676, 424, 567, 439], min_good: 3 },
  { id: "karaoke", msg: "karaoke tonight", f: { keywords: ["karaoke"] }, must_top: [[507, 3]], good: [507, 1028, 955, 1002], min_good: 3 },
  { id: "hookah", msg: "chill lounge with hookah", f: { keywords: ["hookah", "lounge"], energy: "Chill" },
    relevant: (r) => (r.hookah || "").toLowerCase() === "yes" || /hookah|hooka|shisha/i.test(r.venue_name || ""), min_relevant: 8 },
  { id: "brunch", msg: "brunch with bottomless mimosas", f: { meal_service: "brunch", keywords: ["bottomless mimosas"] },
    must_top: [[684, 5]], relevant: (r) => (r.meal_services || {}).brunch === true || (r.cuisine_tags || []).includes("brunch"), min_relevant: 9 },
  { id: "steakhouse", msg: "fancy steakhouse for a birthday dinner", f: { venue_type: "restaurant", cuisine: "steakhouse", price_band: "$$$$", keywords: ["birthday"] },
    relevant: (r) => (r.cuisine_tags || []).includes("steakhouse") && ["$$$", "$$$$"].includes(r.price_band), min_relevant: 7 },
  { id: "tacos", msg: "cheap tacos", f: { cuisine: "tacos", price_band: "$" }, good: [964, 831, 454, 810, 805], min_good: 3 },
  { id: "sushi", msg: "romantic sushi dinner", f: { cuisine: "sushi", keywords: ["romantic"] }, good: [1108, 1068, 830, 1100, 460], min_good: 3 },
  { id: "speakeasy", msg: "speakeasy cocktail bar", f: { venue_type: "bar", keywords: ["speakeasy", "cocktails"] }, must_top: [[430, 5], [421, 5]] },
  { id: "burger_patio", msg: "burger spot with a patio in Midtown", f: { cuisine: "burgers", neighborhood: "Midtown", keywords: ["patio"] }, must_top: [[815, 5]] },
  { id: "happy_hour", msg: "happy hour spots", f: { meal_service: "happy_hour" },
    relevant: (r) => (r.meal_services || {}).happy_hour === true || (r.review_highlights_json || []).some((x) => x && x.rating >= 4 && /happy hour/i.test(x.text || "")), min_relevant: 8 },
  { id: "bar_tonight", msg: "find me a bar for drinks tonight", f: { venue_type: "bar" }, relevant: (r) => (r.google_types || []).includes("bar"), min_relevant: 10 },
  { id: "dislike_loud", msg: "a bar for drinks (user dislikes Loud & Lit, likes Chill & Intimate)", f: { venue_type: "bar", avoid_keywords: ["loud & lit"], preference_keywords: ["chill & intimate"] },
    relevant: (r) => (r.energy_level || "") !== "High" && (r.energy_level || "") !== "Energetic", min_relevant: 9 },
  // ---- Held out: written after tuning, run without changing the ranker. ----
  { held: true, id: "wine_bar", msg: "cozy wine bar", f: { venue_type: "bar", keywords: ["wine", "cozy"] },
    relevant: (r) => /wine|vino|cellar/i.test((r.venue_name || "") + " " + (r.vibe_notes || "")), min_relevant: 6 },
  { held: true, id: "cigar", msg: "cigar lounge", f: { keywords: ["cigar", "lounge"] },
    relevant: (r) => /cigar/i.test((r.venue_name || "") + " " + (r.vibe_notes || "")), min_relevant: 8 },
  { held: true, id: "club_late", msg: "club for dancing late night", f: { venue_type: "club", meal_service: "late_night", keywords: ["dancing"] },
    relevant: (r) => (r.google_types || []).includes("night_club"), min_relevant: 9 },
  { held: true, id: "vegetarian", msg: "vegetarian friendly dinner", f: { venue_type: "restaurant", keywords: ["vegetarian"] },
    relevant: (r) => (r.dietary_tags || {}).vegetarian === true || /vegetarian|vegan/i.test(r.vibe_notes || ""), min_relevant: 7 },
  { held: true, id: "dog_patio", msg: "dog friendly patio bar", f: { venue_type: "bar", keywords: ["dog friendly", "patio"] },
    relevant: (r) => (r.patio || "").toLowerCase() === "yes" || /patio|outdoor/i.test(r.vibe_notes || ""), min_relevant: 8 },
  { held: true, id: "upscale_downtown", msg: "upscale cocktail lounge downtown", f: { neighborhood: "Downtown", price_band: "$$$", keywords: ["cocktails", "upscale"] },
    relevant: (r) => /central business district|downtown/i.test((r.area_neighborhood || "") + (r.neighborhood_text || "")), min_relevant: 6 },
  { held: true, id: "live_music_open", msg: "live music open right now", f: { open_now: true, keywords: ["live music"] },
    relevant: (r) => /live music|live band|live jazz/i.test((r.vibe_notes || "") + " " + (r.music || "")) || (r.review_highlights_json || []).some((x) => x && x.rating >= 4 && /live (music|band)/i.test(x.text || "")), min_relevant: 7 },
];

function check(c, ids) {
  const problems = [];
  for (const [id, n] of c.must_top || []) if (!ids.slice(0, n).includes(id)) problems.push(`${id} not in top ${n}`);
  for (const id of c.bad || []) if (ids.includes(id)) problems.push(`bad ${id} present`);
  let goodN = null, relN = null;
  if (c.good) { goodN = c.good.filter((g) => ids.includes(g)).length; if (goodN < c.min_good) problems.push(`good ${goodN}/${c.min_good}`); }
  if (c.relevant) { relN = ids.filter((id) => byId[id] && c.relevant(byId[id])).length; if (relN < c.min_relevant) problems.push(`relevant ${relN}/${c.min_relevant}`); }
  return { problems, goodN, relN };
}
const only = process.argv[2];
let pass = { live: 0, new: 0 }, total = 0, ms = 0;
for (const c of cases) {
  if (only && c.id !== only) continue;
  total++;
  const live = liveRank(c.f);
  const t0 = Date.now();
  const res = rank(Object.assign({ clock, limit: 10, min_results: 3 }, c.f), rows);
  ms += Date.now() - t0;
  const ids = res.top.map((t) => t.id);
  const L = check(c, live), N = check(c, ids);
  if (!L.problems.length) pass.live++;
  if (!N.problems.length) pass.new++;
  console.log(`\n### ${c.id}: "${c.msg}"  quality=${res.match_quality} relaxed=[${res.relaxed}] pool=${res.pool_count}`);
  console.log(`  live: ${L.problems.length ? "FAIL " + L.problems.join("; ") : "pass"}${L.relN != null ? " rel=" + L.relN : ""}${L.goodN != null ? " good=" + L.goodN : ""}`);
  console.log(`  new : ${N.problems.length ? "FAIL " + N.problems.join("; ") : "pass"}${N.relN != null ? " rel=" + N.relN : ""}${N.goodN != null ? " good=" + N.goodN : ""}`);
  if (only || process.env.SHOW) {
    console.log("  live top10:", live.map((id) => `${id} ${byId[id].venue_name.slice(0, 22)}`).join(" | "));
    for (const t of res.top) console.log(`   ${t.id} ${t.row.venue_name.slice(0, 30).padEnd(30)} ${t.score.toFixed(2).padStart(6)} ${JSON.stringify(t.breakdown)} ${JSON.stringify(t.matched)}`);
  }
}
console.log(`\nPASS live ${pass.live}/${total}  new ${pass.new}/${total}   avg new rank time ${Math.round(ms / total)} ms`);
