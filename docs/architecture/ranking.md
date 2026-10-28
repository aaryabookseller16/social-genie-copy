# Venue Ranking

How Genie builds the shortlist the model chooses from. The model only picks among these venues, so this step caps answer quality. GEN-071 (2026-10-22) made one ranker handle every venue turn on the capstone branch. Xano objects are on `flutter-v2-sandbox-tamu-capstone`; changelog rows #76–#83 in `xano/CHANGELOG.md`.

> **Status (2026-10-27):** Zach's conversation v1 deploy (2026-10-23) replaced `fn_genie_search_venues_dev`. The user-context terms (`preference_keywords`, `avoid_keywords`) below are no longer accepted by the live search, so saved likes and dislikes only reach the prompt. Left as is by decision; see `xano/genie-workflow-and-architecture.md` (Known gaps) and changelog #95.

## Pipeline (venue turn)

```
message ──► fn_genie_detect_query_mode_dev (1919, English keywords; kept as the fallback)
        ──► fn_genie_extract_search_filters_dev (2209, gpt-4o-mini): mode + filters, any language
        ──► city: named in the message / sent by the app, else nearest to the location
        ──► fn_genie_handle_message_dev (1960, legacy: session, logging, reply bank)
        ──► user context (GEN-013/014): preference and avoid keywords
        ──► fn_genie_search_venues_dev (2192): exclude, filter, score, relax, rank
        ──► fn_genie_run_turn_dev: the model picks 3 of the top 10 and writes reasons
```

All of it runs in `fn_genie_handle_message_v2_dev` (1936). Kill switches there: `$filters_model_enabled` (false: English rules only), `$search_all_turns` (false: search only on turns where the legacy handler found venues and no location was sent, the GEN-013 rule), `$search_enabled` (false: legacy shortlist only).

## 1. Mode and filters (2209)

One gpt-4o-mini call (JSON mode, temperature 0.1) reads the message in any language and returns `mode` (venue, event, ambient), `city`, `neighborhood`, `venue_type`, `cuisine`, `meal_service`, `open_now`, `price_band`, `energy`, up to 5 English `keywords` and `language`. The model judges by meaning: "a bar tonight" is a venue request, "conciertos este fin de semana" an event request, and a neighborhood is a venue filter, so there is no city-specific neighborhood list. Code only checks the shape (allowed values, lengths). On any failure 1936 keeps the keyword result.

The legacy handler (1960) still runs its own English event check; when the model said venue, 1936 keeps venue mode and sets the legacy events aside (they come back only if the search finds nothing).

Eval: 30 English and Spanish messages, 30/30 on two runs (`fn_genie_extract_search_filters_dev` row in the changelog).

## 2. City

A city named in the message (or sent by the app) must be an active row in `city_graph_cities`; with only a location, the nearest supported city (`fn_resolve_nearest_city_dev`). A city that is not supported skips the search and the legacy handler answers as before. Debug: `search.city`.

## 3. Exclusions (never shortlisted)

Closed (Google status or closed flags), not active, lodging, vape / smoke shop / dispensary / party-supply / event-hall names, no data at all (no rating, no vibe, no cuisine), and no bar / restaurant / cafe type with no hospitality word in the name and no vibe notes. Counts per reason in the search debug (`excluded`).

## 4. Filters and relaxing

- `venue_type` from google_types; "restaurant" also accepts bars with cuisine tags (a burger bar).
- `cuisine`: the cuisine tags (singular or plural), name or vibe, plus an alias map in 2192 (`$cuisine_aliases`: sushi/ramen → japanese, tacos/mexican → tex_mex, pho → vietnamese, pizza/pasta → italian, barbecue → bbq …). Houston has only 14 tags: steakhouse 69, brunch 68, burgers 42, vietnamese 40, italian 26, seafood 25, bbq 17, japanese 14, soul_food 11, tex_mex 6, mediterranean 4, thai 3, chinese 2, indian 2.
- `neighborhood`: the neighborhood fields or address name it, or the venue is within 1.5 km of the centre of the venues that do (only 4 venues say "Midtown").
- `price_band` by bucket: budget ($, $$) or upscale ($$$, $$$$), so "fancy" read as $$$ or $$$$ gives the same pool.
- `meal_service`, `open_now` (computed from Google hours), and with a location the radius (default 5 km; the app sends 2.5 km).

When fewer than 3 venues match, filters are relaxed in this order and listed in `relaxed`: meal_service, open_now, price_band, radius_x2 (double the radius), radius (drop it), venue_type, neighborhood, cuisine. A relaxed filter still counts in the score (+8 for each one a venue meets), so the few venues that do match stay on top. `match_quality`: strong (every filter met, at least 3), loose (relaxed or few), empty.

## 5. Score

| Part | Weight | Notes |
|---|---|---|
| rating | 6 × (Bayesian rating − 3.5), 0 below 3.5 | Bayesian: pulled toward 4.3 until a venue has many reviews, so 5 stars from 3 reviews does not win. About 0–9. |
| data | vibe notes +1, energy level +0.3, hours +0.3, photo +0.2 | Venues with something to say rank a little higher. |
| keywords | 10 × share of the request's keyword words found in the venue text | Whole words (plurals count). Venue text: vibe notes, crowd, music, name, cuisine tags, and "patio outdoor seating" when patio = yes. Scoring by word coverage means "live jazz" and "live music" + "jazz" score a venue about the same. |
| energy | +2 when the requested energy matches | |
| prefs | +1 per saved taste found, at most 2 | User context (GEN-013). |
| avoid | −2 per saved dislike found, at most 2 | User context (GEN-014). Never a filter. |
| distance | −0.5 per km beyond 1 km, at most −3 | Only with a location. |
| price | +1 for the exact band | The filter is by bucket. |
| relaxed fit | +8 per relaxed filter the venue still meets | Only when filters were relaxed. |

Why these sizes: fully matching the request's keywords (+10) outweighs the rating gap between a 4.8 and a 4.3 venue (about +3), so venues that match the request come first and rating breaks ties among them. Saved preferences (at most +2) and distance (at most −3) only reorder venues that fit about equally. Before GEN-071 a keyword was +3, and a better-rated bar without "rooftop" outranked the rooftop bar for "rooftop bar in Midtown".

The weights live in one `w` object at the top of the JavaScript step in 2192, with the same table in its header.

## 6. Observability

`search.ranking` in the chat response (and the search debug) lists every shortlisted venue with `score`, `breakdown` (the parts above, which add up to the score), `km`, `gaps` and hit counts. `search.filters` is the model's filters and `search.source` says whether they came from the model or the English rules.

## 7. Thin data

`data_gaps` (vibe, hours, price, rating) is added to each model venue that is missing those fields (`fn_genie_format_venue_for_model_dev`, 2089). When any candidate has gaps, the pick prompt (2091, rule 6c) tells the model to write the reason only from the fields the venue has, or say details are limited. In Houston 304 venues have no vibe notes; filling them would help more than any weight change.

## 8. Paid placement

No ranking step reads a paid or sponsor field (`priority_*`, `sb_*`, vendor fields): not 2192, not the legacy 1960 / 1843 path, not `fn_genie_profile_score_venue_dev`. The model formatter and the card row leave them out too, and the prompt tells the model it is given no paid-placement information.

## 9. Still open

- F13: `run_turn` still receives the raw `city_context` string. The resolved city is ready in 1936 (`$resolved_city`); passing it means changing one existing line in 1936.
- The legacy handler (1960) still runs on every venue turn for the session, logging and reply bank, and its shortlist is computed and then replaced. Removing it from venue turns would save time but touches teammates' code.
- Only Houston is active in `city_graph_cities` on `tamu_capstone`.
- `meal_service` happy_hour and late_night use `ms_*` flags that look defaulted in the data.
- Canonical preference values ("Loud & Lit") rarely appear in venue text (see `user_context.md` section 7).
