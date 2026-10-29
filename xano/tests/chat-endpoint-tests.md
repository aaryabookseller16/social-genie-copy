# Chat endpoint tests (`ep_genie_chat_v2_dev`)

Manual cases for the Xano run panel of `ep_genie_chat_v2_dev` (branch `flutter-v2-sandbox-tamu-capstone`). They cover the reply paths the model does not write yet (city prompts, no results, errors, events, ambient, neighborhood) and a regression set for the request and follow-up turns that already work. Open issues found with these cases: `docs/architecture/genie-open-issues-2026-10-29.md`.

## How to run

- Send `"debug": true` so `llm`, `search` and `turn` are in the response.
- Each case has its own `session_token`, and `external_user_id` uses the same value. Cases marked "same token" continue a conversation and must run in order.
- **Re-running:** a token that was already used continues the old conversation. A request can then be classified as a follow-up, or leave out venues that were already shown. For every re-run, change the token and the `external_user_id` to new values (for example `t-a1` → `t-a1-2` → `t-a1-3`), and change all turns of a multi-turn case together.
- "Baseline" is what the endpoint returned on 2026-10-29, before any of the fixes in the issues doc. "Expected" is the target after those fixes.

## Checks for every case

- `success` is true and `reply` is not empty.
- `reply` is in the language of the message.
- Cards (`venues`, `turn_venues`, `events`, `turn_events`) are slim objects, never full database rows (no `review_highlights_json`, `priority_tier`, `sb_*`, `phone`, `is_vendor_subscriber`).
- `llm.reason_flags` is `[]` (report-only; a flag is a finding, not a failure).

---

## A. City and location

### A1: unsupported city, English
```json
{"message": "best bars in Paris", "channel": "web", "external_user_id": "t-a1", "session_token": "t-a1", "debug": true}
```
- **Baseline:** `reply_mode` `unsupported_city`, fixed English "I don't cover Paris yet. Right now I can search Houston. Want me to look there?", `llm.used` false.
- **Expected:** a reply written by the model that says Genie does not cover Paris yet and offers Houston. No venue names, `venues` [] and `pick_reasons` []. `turn.source` is still `location_prompt`.

### A2: unsupported city, Spanish
```json
{"message": "los mejores bares en París", "channel": "web", "external_user_id": "t-a2", "session_token": "t-a2", "debug": true}
```
- **Baseline:** `reply_mode` `city_missing` (París with an accent was not recognized), fixed English "Which city should I search? I can cover Houston."
- **Expected:** `reply_mode` `unsupported_city`, `unsupported_city` "París" (or "Paris"), a Spanish reply like A1.

### A3: city missing
```json
{"message": "find me a rooftop bar", "channel": "web", "external_user_id": "t-a3", "session_token": "t-a3", "debug": true}
```
No `city_context`, `lat` or `lng`.
- **Baseline:** `reply_mode` `city_missing`, fixed English "Which city should I search? I can cover Houston."
- **Expected:** the model asks which city and names Houston. `turn.source` `location_prompt`.

### A4: answering the city prompt (same token as A3, run after A3)
```json
{"message": "Houston", "channel": "web", "external_user_id": "t-a3", "session_token": "t-a3", "debug": true}
```
- **Baseline (pass):** `turn_kind` `request`, `turn_index` 2, `turn.search_message` "find me a rooftop bar Houston", 3 rooftop picks (Sunset Rooftop Lounge, Sol7, Z on 23), `reason_flags` [].
- **Expected:** unchanged.

### A5: outside the supported area
```json
{"message": "bars near me", "channel": "web", "external_user_id": "t-a5", "session_token": "t-a5", "lat": 30.2672, "lng": -97.7431, "debug": true}
```
Austin coordinates.
- **Baseline:** `reply_mode` `outside_supported_area`, fixed English "It looks like you're outside the cities I cover right now…"
- **Expected:** a model reply that says the location is outside the covered cities and offers Houston.

## B. No results and errors

### B1: nothing matches, English
```json
{"message": "underwater opera bar with a helipad", "channel": "web", "external_user_id": "t-b1", "session_token": "t-b1", "city_context": "Houston", "debug": true}
```
- **Baseline:** the search loosens the filters and never returns zero (`match_quality` `loose`, summary "None of these places show underwater or helipad."). The pick prompt replied "No underwater or helipad bars, so here are lively spots in Houston." with 3 picks.
- **Expected:** unchanged; this is acceptable behavior. If `search.count` is 0 on some run, the reply is written by the model, names no venue and suggests a looser request.

### B2: nothing matches, Spanish
```json
{"message": "bar de ópera submarino con helipuerto", "channel": "web", "external_user_id": "t-b2", "session_token": "t-b2", "city_context": "Houston", "debug": true}
```
- **Baseline:** like B1, in Spanish ("No hay bares con ópera, submarino o helipuerto, pero aquí hay otros bares en Houston."). The "pero" contrast is not flagged (the contrast flags are English only).
- **Expected:** like B1, in Spanish, no contrast.

### B3: "show me more" until everything was shown (same token for all turns)
Turn 1:
```json
{"message": "karaoke bars", "channel": "web", "external_user_id": "t-b3", "session_token": "t-b3", "city_context": "Houston", "debug": true}
```
Then repeat this until the reply changes:
```json
{"message": "show me more", "channel": "web", "external_user_id": "t-b3", "session_token": "t-b3", "city_context": "Houston", "debug": true}
```
- **Baseline:** 6 "show me more" turns. Each excluded the earlier picks (`excluded_count` 3, 6, 9, …) and wrote "guests mention karaoke" for review-only matches. On turn 7 the karaoke matches ran out and the reply was "No karaoke bars found, so here are other bars in Houston." with 3 non-karaoke bars. "That's everything I've got…" was never reached.
- **Expected:** unchanged, or once nothing at all is left: a model reply that says everything matching was shown, with no venue names.

### B4: search error
Cannot be triggered from the endpoint. Test it only by making the search throw on a draft.
- **Baseline:** fixed English "I hit a snag searching just now. Give it another try in a moment."
- **Expected:** a model reply in the user's language; `reply_mode` still `search_error`.

## C. Events and ambient

### C1: event request
```json
{"message": "any events this weekend?", "channel": "web", "external_user_id": "t-c1", "session_token": "t-c1", "city_context": "Houston", "debug": true}
```
- **Baseline:** `query_mode` `event`, fixed text "Here are some events happening in Houston that match your vibe.", `llm.used` false, `pick_reasons` []. `events` and `turn_events` are full database rows with the joined venue row. The events returned are the next 10 upcoming (Oct 29–30), not the weekend. Every event is linked to venue 1129 "Shell Energy".
- **Expected:** 3 event picks with reasons written by the model, events from the asked dates, slim event cards.

### C2: event request that should find nothing
```json
{"message": "any jazz festivals tonight?", "channel": "web", "external_user_id": "t-c2", "session_token": "t-c2", "city_context": "Houston", "debug": true}
```
- **Baseline:** same 10 events and fixed text as C1 (keywords and "tonight" are ignored), so the switch to venues never happens.
- **Expected:** events filtered by keyword and date. If none match, one model reply that says no events matched and gives 3 venue picks.

### C3: ambient, English
```json
{"message": "surprise me, I'm bored", "channel": "web", "external_user_id": "t-c3", "session_token": "t-c3", "city_context": "Houston", "debug": true}
```
- **Baseline:** `query_mode` `ambient`, reply bank "Let me put something together for you. Here's what's good tonight.", `llm.used` false. `venues`, `turn_venues`, `events` are full database rows (review author names and photos, `priority_tier`, phone). Picks include an event hall in Humble (Bienvenue Events), a hookah lounge with 2 ratings and a 24-hour breakfast place.
- **Expected:** 3 picks with reasons written by the model, slim cards, reasonable picks.

### C4: ambient, Spanish
```json
{"message": "sorpréndeme, estoy aburrido", "channel": "web", "external_user_id": "t-c4", "session_token": "t-c4", "city_context": "Houston", "debug": true}
```
- **Baseline:** like C3, with the English reply-bank text.
- **Expected:** like C3, in Spanish.

## D. Neighborhood

### D1: neighborhood request
```json
{"message": "what's good in Montrose?", "channel": "web", "external_user_id": "t-d1", "session_token": "t-d1", "city_context": "Houston", "debug": true}
```
- **Baseline:** the filter model returned `mode` `ambient` with `neighborhood` "Montrose". The ambient path ignored the neighborhood and returned the same list as C3 (Mid West, Northside, Humble), reply bank text, full database rows.
- **Expected:** a venue request with `search.neighborhood` "Montrose", 3 Montrose picks written by the model, slim cards.

## E. Time

### E1: open right now
```json
{"message": "bars open right now", "channel": "web", "external_user_id": "t-e1", "session_token": "t-e1", "city_context": "Houston", "debug": true}
```
- **Baseline (pass):** `search.open_now` true, `search.time_asked` true, 3 open bars (Lost & Found, Twin Peaks, Postino Montrose), `reason_flags` [].
- **Expected:** unchanged. After the time zone fix, the "Now" line in the prompt uses the resolved city's time zone.

## F. Regression (must stay the same or get better)

### F1: venue request with a widened area
```json
{"message": "rooftop bar in Midtown", "channel": "web", "external_user_id": "t-f1", "session_token": "t-f1", "city_context": "Houston", "debug": true}
```
- **Baseline (pass):** `pick-v4`, `relaxed` ["neighborhood"], 3 rooftop picks (Sol7, Sunset Rooftop Lounge, Z on 23), `reason_flags` []. Intro: "Midtown has just one rooftop bar, so I added the closest ones." The count "just one" is not in the search summary ("Few places in Midtown…").
- **Expected:** same picks; the intro says what the summary says without inventing a count.

### F2: follow-up (same token as F1, run after F1)
```json
{"message": "does the second one have a patio?", "channel": "web", "external_user_id": "t-f1", "session_token": "t-f1", "city_context": "Houston", "debug": true}
```
- **Baseline (pass, to verify):** `turn_kind` `followup`, `converse-v2`, `search_ms` 0, answer about Sunset Rooftop Lounge (the second pick): "Yes, Sunset Rooftop Lounge has a patio…". Check that venue 541's `patio` field is "yes"; if it is empty, this is an invented answer.
- **Expected:** the answer matches the venue's `patio` field ("not sure" when it is empty).

### F3: follow-up that uses saved matches
Turn 1:
```json
{"message": "karaoke bars tonight", "channel": "web", "external_user_id": "t-f3", "session_token": "t-f3", "city_context": "Houston", "debug": true}
```
Turn 2 (same token):
```json
{"message": "do they actually do karaoke at the second one?", "channel": "web", "external_user_id": "t-f3", "session_token": "t-f3", "city_context": "Houston", "debug": true}
```
- **Baseline:** turn 1 picks Yaksok, Just 2 More, Lem's (the order changes between runs). One flag `opens at`: "Cozy lounge with guest-mentioned karaoke nights, opens at 4 PM." Turn 2: "Guests mention karaoke nights at Just 2 More Sports Bar, but it's worth calling ahead to check which nights they have it." with flag `but it`.
- **Expected:** turn 1 without "opens at"; turn 2 says guests mention karaoke, with "Worth calling ahead…" as its own sentence. `reason_flags` [] on both.

### F4: Spanish venue request
```json
{"message": "un bar con terraza en Midtown", "channel": "web", "external_user_id": "t-f4", "session_token": "t-f4", "city_context": "Houston", "debug": true}
```
- **Baseline (pass, with notes):** Spanish reply, 3 patio picks (Jethro's, Little Woodrow's Midtown, Social Beer Garden HTX). The intro says all three are in Midtown and the second reason says "en Midtown", but Little Woodrow's and Social Beer Garden have `area_neighborhood` "South Central Houston".
- **Expected:** Spanish, patio picks, areas stated as the data gives them.

### F5: "anything cheaper?" (same token as F1, run after F2)
```json
{"message": "anything cheaper?", "channel": "web", "external_user_id": "t-f1", "session_token": "t-f1", "city_context": "Houston", "debug": true}
```
- **Baseline (fail):** `turn_kind` `request`, `turn.inherit_filters` true, filters kept rooftop + Midtown and added `price_band` "$". Reply: "No cheaper rooftop bars, but here are affordable bars nearby." Picks: RIPCORD ($), Two Headed Dog ($$), The Continental Club ($$). Two of the three are not cheaper than the first request's picks ($$ and $$$). The price only added +1 to the score. The `search` debug block in the pasted output had its spaces, underscores and "$" signs missing between the two "$" characters (`matchquality`, `venuetype`, "price: .Fewplaces…"); recheck the raw response.
- **Expected:** picks priced below the earlier picks (or a plain statement that there are none), no "but" contrast, an intact `search` block.

### F6: new conversation (reuses the F1 token)
```json
{"message": "rooftop bar in Midtown", "channel": "web", "external_user_id": "t-f1", "session_token": "t-f1", "new_conversation": true, "city_context": "Houston", "debug": true}
```
- **Baseline (pass):** a new `session_token` (a UUID) comes back, `turn_index` 1, same picks as F1.
- **Expected:** unchanged.
