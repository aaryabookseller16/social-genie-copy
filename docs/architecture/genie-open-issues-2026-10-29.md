# Genie open issues (2026-10-29)

Found by running `xano/tests/chat-endpoint-tests.md` against `ep_genie_chat_v2_dev` on branch `flutter-v2-sandbox-tamu-capstone` on 2026-10-29, and by reading `fn_genie_handle_message_v2_dev`. Case IDs (A1, F5, …) refer to that file. Line numbers are for `xano/flutter-v2-sandbox-tamu-capstone/functions/fn_genie_handle_message_v2_dev.xs` as of today.

Venue request and follow-up turns work well (A4, E1, F1–F4, F6). The problems are on the other paths and in a few details of the replies.

## Summary

| # | Issue | Priority | Cases |
|---|---|---|---|
| 1 | Ambient, neighborhood and event turns return full database rows to the client | High | C1–C4, D1 |
| 2 | Neighborhood requests are treated as ambient and the neighborhood is ignored | High | D1 |
| 3 | Event search ignores keywords and dates; event data all points at one venue | High | C1, C2 |
| 4 | "Cheaper" and other price requests are not enforced | Medium | F5 |
| 5 | Many replies are fixed English text, not written by the model | Medium | A1–A5, B4, C1–C4 |
| 6 | Accented city names are not recognized | Medium | A2 |
| 7 | Ambient picks are poor and never reach the model | Medium | C3, C4 |
| 8 | Some reply details are not grounded in the data | Medium | F1, F2, F4 |
| 9 | Contrast wording still slips through, and the check is English only | Low | B2, F3, F5 |
| 10 | Opening times mentioned when not asked | Low | F3 |
| 11 | Search debug block looked corrupted in one run | Low (verify) | F5 |
| 12 | Local time is hard-coded to US Central | Low | E1 |
| 13 | The no-results path is almost never reached | Info | B1–B3 |
| 14 | Legacy objects still exist | Info | — |

---

## 1. Full database rows returned to the client (High)

**What happens.** On ambient turns (C3, C4, D1) `venues` and `turn_venues` are complete `genie_venues` rows. On event turns (C1, C2, and the events in C3/C4/D1) `events` and `turn_events` are complete `genie_social_events` rows with the full venue row joined. They include:
- review author names and profile photo URLs (`review_highlights_json`)
- paid-placement and vendor fields: `priority_tier`, `priority_placement_until`, `is_vendor_subscriber`, `is_official_vendor`, `score_components_json`
- `sb_*` activity counters, phone numbers, enrichment and pipeline fields

Venue request turns are fine: they return slim cards from `fn_genie_slim_venue_row_dev`.

**Why it matters.** The model never sees these fields, but every client does. The formatter whitelist exists to keep paid placement, other users' activity and personal data out of Genie; this path skips it. The responses are also very large.

**Fix.** Slim the ambient venue rows with `fn_genie_slim_venue_row_dev` before they reach `venue_results` (handler lines ~1096–1141), and add a slim event card (id, title, date, start time, category, venue name, address, image, ticket URL) used for `events` and `turn_events` on every path (event query at ~848–911, enrichment at ~2340–2370).

**Files.** `fn_genie_handle_message_v2_dev`; possibly a new `fn_genie_slim_event_row_dev`.

## 2. Neighborhood requests treated as ambient (High)

**What happens.** D1 "what's good in Montrose?" came back from the filter model as `mode: "ambient"`, `neighborhood: "Montrose"`. The ambient path does not use the neighborhood, so the answer was the same list as C3 with nothing in Montrose. The separate `neighborhood` mode (handler ~1037–1093) is only reached when the filter model fails, because the model never returns that mode.

**Fix.** Either a rule in `fn_genie_extract_search_filters_dev` ("a request naming a place or neighborhood is a venue request"), or in the handler: when `mode` is `ambient` and `neighborhood` is set, run it as a venue search with that neighborhood. The handler check is the safer of the two because it does not depend on the model. The legacy `neighborhood` mode can then be mapped to the same venue search.

**Files.** `fn_genie_handle_message_v2_dev`, optionally `fn_genie_extract_search_filters_dev`.

## 3. Event search ignores the request (High)

**What happens.** The event query (handler ~848–911) selects active events in the city from today on, sorted by date, 10 per page. It does not use keywords, category or dates. C1 "this weekend" and C2 "jazz festivals tonight" got the same 10 events (Oct 29–30). Because something always comes back, the "no events, try venues" fallback never runs.

**Data problem, separate from code.** Every event returned is linked to `venue_id` 1129 "Shell Energy" (`devnauts.io`, phone `030000000`), although the event addresses differ. This needs to go to whoever owns event ingestion.

**Fix.** Filter events by date range ("tonight", "this weekend", a weekday) and by keywords or category from the filter step, before anything is shown. Then send the events through the pick prompt (see 5) so the reply has 3 picks with reasons.

**Files.** `fn_genie_handle_message_v2_dev`, `fn_genie_extract_search_filters_dev` (date range), possibly a new event search function.

## 4. Price requests are not enforced (Medium)

**What happens.** F5 "anything cheaper?" after rooftop bars in Midtown: the filters were inherited and `price_band` "$" was added, but price only adds +1 to the ranking score. Two of the three picks were $$, the same as or more than before. The reply ("No cheaper rooftop bars, but here are affordable bars nearby") called them affordable.

**Fix.** In `fn_genie_search_venues_dev`, treat `price_band` as a filter (at or below the asked band) when enough venues pass, and loosen it only through the existing relaxation step, which then appears in the search summary. For "cheaper", compare with the price bands of the earlier picks rather than jumping to "$".

**Files.** `fn_genie_search_venues_dev`, possibly `fn_genie_extract_search_filters_dev`.

## 5. Fixed English replies (Medium)

**What happens.** These replies are fixed strings or reply-bank text. They ignore the user's language and the request:

| Path | Text today | Handler lines |
|---|---|---|
| Unsupported city / outside area / city missing | "I don't cover X yet…", "Which city should I search?…" | ~530–676 |
| Search error | "I hit a snag searching just now…" | ~1887 |
| No results | "I couldn't find a match…", "That's everything I've got…" | ~1891–1911 |
| Event request with results | "Here are some events happening in Houston that match your vibe." | ~896 |
| No events, switched to venues | "I couldn't find any events in Houston." in front of the reply | ~2398–2404 |
| Ambient | reply bank "Let me put something together for you…" | ~1133–1139 |
| Neighborhood | reply bank | ~1081–1091 |
| Pick model wrote nothing | reply bank | ~2017–2050 |
| Rain override, last resort | reply bank, "Let me find something great for you." | ~2372–2396 |

**Fix.**
- A new `answer` prompt type in `fn_genie_build_prompt_dev` (0 picks), built from the shared role, guardrail and reply-language blocks. It gets a short facts line ("unsupported city: Paris; supported: Houston", "search error") and must never name a venue. `fn_genie_run_turn_dev` runs it with `gpt-4o-mini` and rejects any pick. Use it for the city paths and the search error.
- Events and ambient go through the existing pick prompt (after 1 and 3).
- The fixed text stays as the fallback when the model call fails.
- The location prompt turn must still be logged with `pending_request_text` so A4 keeps working.

**Files.** `fn_genie_build_prompt_dev`, `fn_genie_run_turn_dev`, `fn_genie_handle_message_v2_dev`.

## 6. Accented city names not recognized (Medium)

**What happens.** A2 "los mejores bares en París" returned `city_missing` instead of `unsupported_city`, so the reply asked which city to search.

**Fix.** Compare city names without accents in `fn_genie_resolve_city_dev`, or use the `city` the filter model returns when the resolver finds nothing.

**Files.** `fn_genie_resolve_city_dev`.

## 7. Ambient picks (Medium)

**What happens.** C3/C4 picks came from `fn_genie_get_ambient_recommendations_dev` with no model step: an event hall in Humble (Bienvenue Events), a hookah lounge with 2 ratings, a 24-hour breakfast place, a nightclub that was closed. The Spanish request got the English reply-bank text.

**Fix.** Use the venue search with no filters (it already excludes low-rated, non-hospitality and unverified places) plus upcoming events as the ambient candidates, and let the pick prompt choose 3. Depends on 1 and 5.

**Files.** `fn_genie_handle_message_v2_dev`, possibly `fn_genie_get_ambient_recommendations_dev`.

## 8. Reply details not grounded in the data (Medium)

**What happens.**
- F1 intro: "Midtown has just one rooftop bar". The search summary only says "Few places in Midtown have what was asked for". The count was invented.
- F4: the intro says all three patio bars are in Midtown, and a reason says Little Woodrow's Midtown is "en Midtown", but two of the three have `area_neighborhood` "South Central Houston". The name was used as the area.
- F2: "Sunset Rooftop Lounge has a patio". To verify: if venue 541's `patio` field is empty, a rooftop was taken to mean a patio.

**Fix.**
- Give the search summary an exact count when it has one ("1 rooftop bar in Midtown"), so the model has nothing to guess.
- In the prompt, the area named in a reason comes from `neighborhood`, never from the venue name, and the intro only describes the area of picks that are in it.
- Add `patio`/`rooftop` to the unsupported-claim check for converse replies if it is not already covered.

**Files.** `fn_genie_handle_message_v2_dev` (summary lambda), `fn_genie_build_prompt_dev`, `fn_genie_run_turn_dev`.

## 9. Contrast wording (Low)

**What happens.**
- F3 turn 2: "Guests mention karaoke nights…, but it's worth calling ahead…" (flag `but it`). The build_prompt rule that asks for a separate sentence is in the repo; check that it was published, then re-run F3.
- F5: "No cheaper rooftop bars, but here are…" was not flagged, because the flag looks for "but it".
- B2: "pero aquí hay otros bares" (Spanish) is not checked at all.

**Fix.** Widen the contrast check to ", but " and to the Spanish words (pero, aunque, sin embargo), and add an example for the "none of these, here are others" intro written as two sentences.

**Files.** `fn_genie_run_turn_dev`, `fn_genie_build_prompt_dev`.

## 10. Opening times mentioned when not asked (Low)

**What happens.** F3 "karaoke bars tonight": "tonight" counts as asking about time, so hours were sent, and a reason said Lem's "opens at 4 PM" (flag `opens at`). The rule allows a closing time when the place is open, not when it opens.

**Fix.** Treat "tonight" as a time question for ranking but keep `today_hours` out of the reason text unless the message asks whether something is open; or make the "opens at" rule stricter in the pick prompt's hours bullet.

**Files.** `fn_genie_handle_message_v2_dev` (`time_asked`), `fn_genie_build_prompt_dev`.

## 11. Search debug block looked corrupted (Low, verify)

**What happens.** In the pasted F5 output, the `search` block lost its spaces, underscores and "$" signs between two "$" characters: "price: .FewplacesinMidtownhavewhatwasaskedfor,…", `matchquality`, `venuetype`, `priceband`, `source` "modelinherited". The `filters` block in the same response is intact.

**Next step.** Re-run F5 and look at the raw response. If it is clean, this was the display rendering text between "$" signs. If it is not, the summary lambda in the handler mishandles "$" in `price_band`.

## 12. Local time hard-coded to US Central (Low)

**What happens.** `now_text` uses `America/Chicago` (handler ~383). Correct for Houston, wrong for any city in another time zone.

**Fix.** Read the time zone from the resolved city (add a column to the city table if there is none), with `America/Chicago` as the default.

**Files.** `fn_genie_handle_message_v2_dev`, `fn_genie_resolve_city_dev`, city table.

## 13. The no-results path is almost never reached (Info)

B1 and B2 never returned zero results: the search loosens the filters, and the pick prompt explained it well in both languages. B3 ran out of karaoke places after 7 turns and switched to other bars instead of saying "That's everything". The `answer` prompt for no results (5) is therefore low priority; the city paths and the search error matter more.

## 14. Legacy objects (Info)

Still present: API `genie/ep_handle_message_dev` (4469), `fn_genie_handle_message_dev` (1960, with `force_ai` / `allow_ai`), `fn_genie_handle_message_dev_01` (1979), `fn_genie_build_ai_payload_dev` (1835), `fn_genie_build_ai_payload_v2_dev` (1929), `fn_genie_llm_commentary_dev` (2057). The web app calls `ep_genie_chat_v2_dev`; Flutter usage is unconfirmed. **Do not delete anything as part of this work.** Removal is a separate codebase clean-up task before handoff: confirm Flutter does not call the legacy endpoint, delete the objects, search the branch for callers, and update `xano/genie-workflow-and-architecture.md` and `docs/api/*`. Keep `fn_genie_call_ai_dev`.

## Suggested order

1. Issues 1 and 2: small, and 1 is a data exposure.
2. Issue 3 (event filtering), then events through the pick prompt.
3. Issue 4 (price).
4. Issue 5 (`answer` prompt for city paths and search error) together with 6.
5. Issue 7, then the low-priority items (8–12).

After each step, re-run the affected cases and the F regression set with new session tokens.
