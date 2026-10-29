# GEN-071 ranking eval (offline)

Tests the venue ranker in `genie/fn_genie_search_venues_dev` without Xano. The ranking step in that function is an `api.lambda` whose code is `ranker_core.js`, inlined by `build_xs.js`. So the code tested here is exactly the code in Xano.

## Files

| File | What it is |
|---|---|
| `ranker_core.js` | The ranker: `rank(args, rows)`. **Edit this, not the `.xs` file.** |
| `search_template.xs` | The XanoScript around the ranker (load venues, call the ranker, format the top 10). |
| `build_xs.js` | Inlines the ranker into the template and writes the function file. |
| `eval_ranker.js` | 22 labelled requests. Each one is run through the new ranker and through a replica of the previous search (live until 2026-10-28). |
| `edge_tests.js` | Contract checks: never throws, top 10 at most, breakdowns add up, filters, location, open now, exclusions, rain. |
| `audit_fill_rates.py`, `audit_terms.py`, `lookup.py` | The data audit behind the design, plus a lookup used to hand-label good venues. |

## Running

```bash
# 1. Export the venues once (tamu_capstone; ~9 MB, includes review text, never commit it):
#    Xano MCP getTableContent, table 29, x-data-source tamu_capstone, pages 1-3 of 250,
#    then join the `items` arrays into venues.json in this folder (or point VENUES at it).
# 2. Evaluate and run the edge tests:
node eval_ranker.js            # all cases, pass/fail for live vs new
node eval_ranker.js rooftop    # one case, with the top 10 and every score breakdown
node edge_tests.js
# 3. Rebuild the Xano function after changing ranker_core.js:
node build_xs.js ../../../flutter-v2-sandbox-tamu-capstone/functions/fn_genie_search_venues_dev.xs
```

The filters in each case are what `fn_genie_extract_search_filters_dev` returns for that message. The model step is skipped, so the cases test ranking only.

## How the labels were made

Labels were picked by reading the venue data (`lookup.py`), not by looking at the ranker's output. There are three kinds of check:
- **must be in the top N**, for example Sunset Rooftop Lounge (541) in the top 3 for "rooftop bars", or Jethro's (815) in the top 5 for "burger spot with a patio in Midtown";
- **good venues**: at least k of a hand-picked set appear in the top 10;
- **relevance rule**: at least k of the top 10 meet a rule. For example, a hookah request expects the `hookah` field to be yes or "hookah" in the name.

Cases 1–15 were used while tuning. Cases 16–22 (`held: true`) were written after tuning and run once before any further change. Two changes followed from them, because they showed general problems rather than label issues: mood words such as "cozy" now count half, and strip clubs are left out unless asked for.

## Results (2026-10-28, 704 Houston venues, Friday 9 PM)

| | Previous search | New ranker |
|---|---|---|
| Tuning cases (15) | 7 pass | **15 pass** |
| Held-out cases (7) | 4 pass | 4 pass |
| All 22 | 11 | **19** |
| Ranking time (all venues, Node) | — | ~40 ms |

The 3 remaining failures are label strictness. In each case the top results are right:
- **wine_bar:** the top 5 are wine bars (VinSanto, La Carafe, Postino, Barcelona Wine Bar, JOEY). The rule only counts "wine" in the name or vibe notes.
- **cigar:** all 6 cigar venues in the data are in the top 7. The rule expected 8.
- **club_late:** Kanpai Club and Tropical Night Club are clubs that Google does not type as `night_club`.

Notable fixes against the previous search:
- **Karaoke:** 0 → 4 good venues. Only review text mentions karaoke.
- **Happy hour:** 2 → 10 relevant. `ms_happy_hour` is defaulted; review text and `meal_services` are used instead.
- **Cheap tacos:** 0 → 4. No venue has a tex_mex tag, so the name and reviews are used.
- **Rooftop:** the 3 real rooftop bars are in the top 5. Before, they were outside the top 10.
- **Two Airbnb-style "Rooftop Lounge" listings:** excluded.

## Known limits
- **Unmarked adult venues:** venues whose name, vibe notes and reviews never say what they are (for example Show Palace) can still appear for "club" requests. That needs a data flag.
- **Review evidence:** it counts less than venue text, and a negation check only looks 30 characters back.
- **Saved preferences:** they are matched through `PREF_TERMS`. Values outside that map are matched literally.
- **Speed in Xano:** measured 2026-10-28 at 1.5–3.6 s `search_ms` through the handler (the previous XanoScript loop took 6–10 s).
- **Match notes:** each top venue returns `matches` ("karaoke: in 2 reviews"), which the search adds to the model venue. The pick prompt does not use it yet; that is GEN-073.
