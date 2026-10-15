# Genie test plan: unit tests U1 to U3 and integration tests I1 to I2

**Written:** October 13, 2026, **before any of these tests were run.** The expected results below are fixed. If a test fails, record the actual result and report it. Do not change the expected result to match.

**Trimmed:** October 15, 2026. The original plan had 8 unit test groups' worth of cases and 8 integration cases. This version keeps 7 cases. The retained cases use the current sequential IDs (for example, U1-01 and I2-01); those IDs may differ from references in notes for the earlier plan. Expected results were not changed.

**Sources:** the `.xs` files of the functions under test (read in full when this plan was written): `fn_genie_validate_picks_dev`, `fn_genie_order_venues_dev`, `fn_genie_format_venue_for_model_dev`, `fn_genie_build_prompt_dev`, `fn_genie_call_ai_dev`, `fn_genie_run_turn_dev`, and `ep_genie_chat_v2_dev`. **Not read:** `fn_genie_load_candidate_venues_dev` (used inside `run_turn`), so its failure-reason text is unknown.

## How to run

- **Unit tests U1, U2, U3:** open the function in Xano, click **Run**, paste the **Input** JSON, run, and screenshot the input and the response together. For `text` inputs that hold JSON (U1's `raw_reply`), the JSON is already escaped as a string in the input below. Paste it as is.
- **Integration test I1:** call the endpoint from Postman or curl, not the run panel (with geo it can take 30+ seconds and the panel can return 502). The URL comes from the API group `genie_v15` in Xano (use the copy-URL button; the path follows the query name `genie/ep_genie_chat_v2_dev`). The non-geo case below takes about 20 seconds.
- **Integration test I2:** run `fn_genie_run_turn_dev` directly in Xano with the input JSON below; do not call the endpoint. Each case takes a few seconds; the happy-path case makes one OpenAI call.
- **Scrub before saving or committing any output.** Venue image URLs contain a Google Maps key (`key=AIza...`). Redact with: `sed -E 's/key=AIza[^"&]*/key=REDACTED/g' response.json > response_clean.json`.
- Each I1 endpoint run writes real rows to the shared tables (messages, sessions, query log). Use the test user and session token shown in its input. I2 runs `fn_genie_run_turn_dev` directly; its candidate loader reads venue data and its happy path makes a real OpenAI call.

## Boundaries and design decisions (verified against the code)

| Test | Unit or components | Outside the boundary |
|---|---|---|
| U1 | `fn_genie_validate_picks_dev` alone | model, DB, all other functions (it receives canned model text) |
| U2 | `fn_genie_order_venues_dev` alone | DB, model, all other functions |
| U3 | `fn_genie_format_venue_for_model_dev` alone | DB (the row is passed in), model |
| I1 | endpoint, router (`fn_genie_handle_message_v2_dev`), handler (`fn_genie_handle_message_dev`), model step (`fn_genie_run_turn_dev`) | the frontend; OpenAI is real |
| I2 | `fn_genie_run_turn_dev` with its loader, prompt builder, `call_ai`, validator, composer and orderer | the router, handler, endpoint and frontend; OpenAI is real |

**Controllability decisions you can cite (each is visible in the code):**
- `fn_genie_validate_picks_dev` takes the model's raw text and the candidates as inputs, plus `max_picks`, so any model answer can be replayed without calling a model (U1).
- `fn_genie_run_turn_dev` exposes `model`, `max_candidates`, `prompt_type`, `timeout` and `max_tokens` as inputs, so failures and the candidate window can be forced cheaply (I2-02).
- The model pipeline is split into single-purpose functions (load, format, prompt, call, validate, compose, order), each testable alone.

**Observability decisions you can cite:**
- The validator returns `valid` and a named `fail_reason` (`empty_reply`, `invalid_json`, `unknown_venue_id`, `too_few_valid_picks`) instead of throwing (U1).
- `run_turn` returns `used`, `fail_reason`, `candidate_count`, `picked_ids`, `model` and `latency_ms`, and writes a `GENIE_RUN_TURN` debug log with the same values (I2). A failure tells you which step stopped (for example `ai_no_reply_status_...` means the model call).
- The endpoint passes the router's `llm` block and `pick_reasons` through to the response (I1).

**Interaction risks you can cite:** the model returns a `venue_id` that is not among the candidates (hard-failed by the validator); the orderer receives duplicate ids; the endpoint response drops the handler's `debug` object, so some intermediate values are visible only in the Xano request history. `more_nearby_venues` was built before the model step and could repeat a pick; the V2 handler now removes picked ids, and the latest I1-01 output has no overlap.

---

## Unit tests

### U1: `fn_genie_validate_picks_dev`

Inputs: `raw_reply` (text), `candidates` (json), `max_picks` (optional, default 3). Returns `valid`, `intro`, `picks`, `fail_reason`. Four candidates are used in every case.

#### U1-01: valid reply with three known ids

**Input**
```json
{
  "raw_reply": "{\"intro\": \"Here are three spots.\", \"picks\": [{\"venue_id\": 101, \"reason\": \"Cozy and quiet.\"}, {\"venue_id\": 103, \"reason\": \"Great food.\"}, {\"venue_id\": 102, \"reason\": \"Lively crowd.\"}]}",
  "candidates": [
    {
      "venue_id": 101,
      "venue_name": "Alpha Bar"
    },
    {
      "venue_id": 102,
      "venue_name": "Beta Lounge"
    },
    {
      "venue_id": 103,
      "venue_name": "Gamma Grill"
    },
    {
      "venue_id": 104,
      "venue_name": "Delta Cafe"
    }
  ]
}
```

**Expected (written before running)**
- `valid` is `true`
- `fail_reason` is `null`
- `intro` is `Here are three spots.`
- `picks` has 3 items in this order: 101 Alpha Bar, 103 Gamma Grill, 102 Beta Lounge, each with the model's reason and the venue name taken from the candidates

**Inspect:** `valid`, `fail_reason`, and the order and names in `picks`.

| Actual (paste or describe) | Pass / Fail | Notes |
|---|---|---|
| `valid: true; intro: "Here are three spots."; picks: [101,103,102]` | Pass | Matches expected order and venue names. |

#### U1-02: a venue id that is not a candidate

**Input**
```json
{
  "raw_reply": "{\"intro\": \"Here you go.\", \"picks\": [{\"venue_id\": 101, \"reason\": \"Cozy.\"}, {\"venue_id\": 999, \"reason\": \"Invented venue.\"}, {\"venue_id\": 102, \"reason\": \"Lively.\"}]}",
  "candidates": [
    {
      "venue_id": 101,
      "venue_name": "Alpha Bar"
    },
    {
      "venue_id": 102,
      "venue_name": "Beta Lounge"
    },
    {
      "venue_id": 103,
      "venue_name": "Gamma Grill"
    },
    {
      "venue_id": 104,
      "venue_name": "Delta Cafe"
    }
  ]
}
```

**Expected (written before running)**
- `valid` is `false`
- `fail_reason` is `unknown_venue_id`
- `picks` is `[]` (all picks dropped on failure)

**Inspect:** `fail_reason` and that `picks` is empty even though two of the three ids were good.

| Actual (paste or describe) | Pass / Fail | Notes |
|---|---|---|
| `valid: false; fail_reason: "unknown_venue_id"; picks: []` | Pass | Matched expected behavior. |

### U2: `fn_genie_order_venues_dev`

Inputs: `venues` (json list), `picked_ids` (json list). Returns the list with picked rows first, in pick order, and the rest in original order. Rows are returned untouched. Five rows are used.

#### U2-01: the same id picked twice

**Input**
```json
{
  "venues": [
    {
      "id": 1,
      "venue_name": "A"
    },
    {
      "id": 2,
      "venue_name": "B"
    },
    {
      "id": 3,
      "venue_name": "C"
    },
    {
      "id": 4,
      "venue_name": "D"
    },
    {
      "id": 5,
      "venue_name": "E"
    }
  ],
  "picked_ids": [
    2,
    2
  ]
}
```

**Expected (written before running)**
- **Intended behavior:** each venue appears once. Output ids in order: `2, 1, 3, 4, 5` (5 rows)

**Inspect:** the row count and whether venue 2 appears twice.

| Actual (paste or describe) | Pass / Fail | Notes |
|---|---|---|
| `[2, 1, 3, 4, 5]` | Pass | Duplicate id 2 was deduplicated, and the remaining rows stayed in original order. |

### U3: `fn_genie_format_venue_for_model_dev`

Input: `venue` (json, one `genie_venues`-shaped row). Returns the object the model is allowed to see. The code builds a whitelist of **40 fields**. In U3-01 the row contains fields that must **not** reach the model.

#### U3-01: full row, including fields that must be hidden

**Input**
```json
{
  "venue": {
    "id": 618,
    "venue_name": "Foundation Room Houston",
    "neighborhood_text": "Central Business District",
    "venue_type": "",
    "address": "1204 Caroline St, Houston, TX 77002, USA",
    "vibe_notes": "An upscale lounge with an exclusive and lively atmosphere.",
    "google_editorial_summary": "",
    "review_summary": "",
    "energy_level": "Energetic",
    "crowd": "Young Professionals",
    "music": "Eclectic",
    "noise_level": "",
    "price_band": "$$$",
    "google_rating": 4.5,
    "google_user_ratings_total": 379,
    "hours_text": "",
    "is_open_now": false,
    "cuisine_tags": [],
    "dietary_tags": [],
    "occasion_tags": [],
    "has_rooftop": false,
    "has_outdoor_seating": false,
    "has_live_music": false,
    "has_dj": true,
    "has_dance_floor": false,
    "has_karaoke": false,
    "has_sports_tv": false,
    "ms_brunch": true,
    "ms_happy_hour": true,
    "happy_hour_details": "",
    "ms_late_night": false,
    "best_time_to_go": "Weekend evenings",
    "good_for_groups": false,
    "good_for_dates": true,
    "good_for_first_dates": false,
    "good_for_celebrations": false,
    "reservations_supported": true,
    "dress_code": "",
    "cover_charge": false,
    "social_energy_state": "quiet",
    "priority_tier": "boost_featured",
    "priority_placement_until": 1785078316187,
    "is_official_vendor": true,
    "is_vendor_subscriber": true,
    "vendor_status": "operating_normally",
    "black_owned": "Yes",
    "woman_owned": true,
    "latino_owned": false,
    "lgbtq_owned": false,
    "veteran_owned": false,
    "sb_save_count": 5,
    "sb_trending_score": 3,
    "review_highlights_json": [
      {
        "text": "Great night out.",
        "author_name": "Reviewer One",
        "rating": 5
      }
    ],
    "phone": "(832) 667-7794",
    "website_url": "https://example.com",
    "latitude": 29.7539291,
    "longitude": -95.3640564,
    "google_maps_url": "https://maps.google.com/?cid=1",
    "image_primary_url": "https://example.com/p.jpg",
    "claim_status": "claimed"
  }
}
```

**Expected (written before running)**
- The output has exactly the 40 whitelisted keys: `venue_id, venue_name, neighborhood, venue_type, address, vibe_notes, summary, review_summary, energy_level, crowd, music, noise_level, price_band, rating, rating_count, hours_text, is_open_now, cuisine_tags, dietary_tags, occasion_tags, has_rooftop, has_outdoor_seating, has_live_music, has_dj, has_dance_floor, has_karaoke, has_sports_tv, brunch, happy_hour, happy_hour_details, late_night, best_time_to_go, good_for_groups, good_for_dates, good_for_first_dates, good_for_celebrations, reservations_supported, dress_code, cover_charge, social_energy_state`
- **None** of these appear in the output: `priority_tier, priority_placement_until, is_official_vendor, is_vendor_subscriber, vendor_status, black_owned, woman_owned, latino_owned, lgbtq_owned, veteran_owned, sb_save_count, sb_trending_score, review_highlights_json, phone, website_url, latitude, longitude, google_maps_url, image_primary_url, claim_status`
- Renamed fields carry the right values: `venue_id` is 618, `neighborhood` is `Central Business District`, `rating` is 4.5, `rating_count` is 379, `brunch` is `true` (from `ms_brunch`), `happy_hour` is `true`, `late_night` is `false`, `has_dj` is `true`, `good_for_dates` is `true`

**Inspect:** count the keys, then search the output for each hidden field name.

| Actual (paste or describe) | Pass / Fail | Notes |
|---|---|---|
| 40 keys; hidden fields absent; `venue_id` 618, `neighborhood` "Central Business District", `brunch: true`, `happy_hour: true`, `late_night: false` | Pass | Whitelist matched expected output exactly. |

---

## Integration tests

### I1: the endpoint `ep_genie_chat_v2_dev` (endpoint, router, handler and model step)

Call from Postman or curl. The case sends `session_query_number` of 2 or more (a first query of a session returns a 500, a known open issue). Use the test user `test-user-1`.

**Intermediate observations available in the response:** `query_mode` (router's mode decision), `reply_mode` (handler's result type), `weather_context_text` (weather step), `llm.used` and `llm.fail_reason` (model step), `pick_reasons` and the order of `venues` (model step output merged with the handler's list). The endpoint implementation includes `session_id` and `session_token`; neither field appears in the latest saved response, and neither is a pass criterion for this case.

**Intermediate observations in the Xano request history (open the request, then its debug logs):** `CORE_ENGINE_FINAL_STATE` from the handler (`reply_mode`, `venues_found`, `venue_results_count`) and `GENIE_RUN_TURN` from the model step (`used`, `fail_reason`, `candidate_count`, `picked_ids`). **Note:** the endpoint response does not include the handler's `debug` object, so counts such as `candidates_total` are not visible in the response.

#### I1-01: venue request through the whole stack

**Input**
```json
{
  "message": "cozy cocktail bar for a date",
  "channel": "app",
  "external_user_id": "test-user-1",
  "city_context": "Houston",
  "session_token": "it-session-01",
  "session_query_number": 2
}
```

**Expected (written before running)**
- `success` is `true`
- `query_mode` is `venue` and `reply_mode` is `has_results`
- `venues` has between 3 and 15 rows (normally 15)
- `llm.used` is `true`, `llm.fail_reason` is `null`, `llm.model` is `gpt-4o`
- `pick_reasons` has exactly 3 items
- The first 3 `venues` ids equal the 3 `pick_reasons` ids, in the same order
- Every `pick_reasons` id is also in `venues`
- `reply` has an intro line followed by lines starting `1. `, `2. ` and `3. ` (the model path's format)
- `weather_context_text` is non-empty and starts with `WEATHER CONTEXT` (record it if empty)
- **No picked id appears in `more_nearby_venues`**

**Inspect:** work through the list from the first router decision (`query_mode`) to the last merge (order of `venues`) so a failure points to a step.

| Actual (paste or describe) | Pass / Fail | Notes |
|---|---|---|
| `success: true; query_mode: "venue"; reply_mode: "has_results"; venues: 15; picks: [636, 922, 612]; first three venue ids match; `llm.used: true`, `fail_reason: null`, `model: "gpt-4o"`; reply has an intro and three numbered lines; weather context starts with `WEATHER CONTEXT`; 11 nearby venues with no picked-id overlap | Pass | All listed expectations passed. `session_id` and `session_token` are absent from the saved response; they are not pass criteria. |

**Post-fix check:** The latest saved I1-01 response has `success: true`, picks `[636, 922, 612]`, and 11 `more_nearby_venues`; none of the picked ids appears in that list.

---

### I2: `fn_genie_run_turn_dev` (loader, formatter, prompt builder, `call_ai`, validator, composer and orderer working together)

Run on the function directly. It receives a fixed list of 15 real venue ids, in a fixed order, from the earlier downtown Houston test. Only the first 10 are shown to the model (the default `max_candidates`). **Intermediate observations** for every case: `candidate_count`, `fail_reason`, `picked_ids`, `latency_ms`, and the `GENIE_RUN_TURN` debug log in the Xano request history.

Candidate window (positions 1 to 10): `618, 1112, 1122, 1115, 437, 454, 529, 714, 730, 732`. Outside the window (positions 11 to 15): `1037, 749, 415, 1056, 1141`.

#### I2-01: happy path

**Input**
```json
{
  "message": "cozy cocktail bar for a date",
  "city": "Houston",
  "venues": [
    {
      "id": 618,
      "venue_name": "Foundation Room Houston"
    },
    {
      "id": 1112,
      "venue_name": "Morton's The Steakhouse"
    },
    {
      "id": 1122,
      "venue_name": "Guard and Grace - Houston"
    },
    {
      "id": 1115,
      "venue_name": "Pappas Bros. Steakhouse"
    },
    {
      "id": 437,
      "venue_name": "Lyric Bar"
    },
    {
      "id": 454,
      "venue_name": "Space City Birria"
    },
    {
      "id": 529,
      "venue_name": "Tom's Watch Bar"
    },
    {
      "id": 714,
      "venue_name": "La Carafe"
    },
    {
      "id": 730,
      "venue_name": "La Fisheria"
    },
    {
      "id": 732,
      "venue_name": "Aquarium Restaurant"
    },
    {
      "id": 1037,
      "venue_name": "PETE'S DUELING PIANO BAR"
    },
    {
      "id": 749,
      "venue_name": "Hull & Oak"
    },
    {
      "id": 415,
      "venue_name": "Reserve 101"
    },
    {
      "id": 1056,
      "venue_name": "Hearsay Market Square"
    },
    {
      "id": 1141,
      "venue_name": "Alley Theatre-Hubbard Stage"
    }
  ]
}
```

**Expected (written before running)**
- `used` is `true`, `fail_reason` is `null`, `model` is `gpt-4o`, `latency_ms` is greater than 0
- `candidate_count` is 10
- `picked_ids` has 3 distinct ids, all from the candidate window (618, 1112, 1122, 1115, 437, 454, 529, 714, 730, 732)
- `picked_ids` contains none of 1037, 749, 415, 1056, 1141 (outside the window; the model never saw them)
- `pick_reasons` has 3 items; their `venue_id` values equal `picked_ids` in the same order; each has a non-empty `venue_name` and `reason`
- `reply` has 4 lines: one intro line, then lines starting `1. `, `2. ` and `3. `, each with the venue name and the reason
- `venues` has 15 rows; the first 3 ids equal `picked_ids`; the other 12 are the remaining input rows in their original order

**Inspect:** `used`, `candidate_count`, `picked_ids` against the window, then the order of `venues`.

| Actual (paste or describe) | Pass / Fail | Notes |
|---|---|---|
| `used: true; candidate_count: 10; picked_ids: [714,437,529]; all in-window; venues begin [714,437,529,...]` | Pass | Happy-path model call succeeded and satisfied the candidate-window constraints. |

#### I2-02: model call fails

**Input**
```json
{
  "message": "cozy cocktail bar for a date",
  "city": "Houston",
  "venues": [
    {
      "id": 618,
      "venue_name": "Foundation Room Houston"
    },
    {
      "id": 1112,
      "venue_name": "Morton's The Steakhouse"
    },
    {
      "id": 1122,
      "venue_name": "Guard and Grace - Houston"
    },
    {
      "id": 1115,
      "venue_name": "Pappas Bros. Steakhouse"
    },
    {
      "id": 437,
      "venue_name": "Lyric Bar"
    },
    {
      "id": 454,
      "venue_name": "Space City Birria"
    },
    {
      "id": 529,
      "venue_name": "Tom's Watch Bar"
    },
    {
      "id": 714,
      "venue_name": "La Carafe"
    },
    {
      "id": 730,
      "venue_name": "La Fisheria"
    },
    {
      "id": 732,
      "venue_name": "Aquarium Restaurant"
    },
    {
      "id": 1037,
      "venue_name": "PETE'S DUELING PIANO BAR"
    },
    {
      "id": 749,
      "venue_name": "Hull & Oak"
    },
    {
      "id": 415,
      "venue_name": "Reserve 101"
    },
    {
      "id": 1056,
      "venue_name": "Hearsay Market Square"
    },
    {
      "id": 1141,
      "venue_name": "Alley Theatre-Hubbard Stage"
    }
  ],
  "model": "not-a-real-model"
}
```

**Expected (written before running)**
- `used` is `false`
- `fail_reason` starts with `ai_no_reply_status_` (for example `ai_no_reply_status_404`)
- `candidate_count` is 10 (the loader and prompt steps worked before the failure)
- `reply` is `null`; `pick_reasons` and `picked_ids` are empty lists
- `venues` is identical to the input list (15 rows, same order)
- `model` is `not-a-real-model`

**Inspect:** `fail_reason` shows the stop was at the model call, and `candidate_count` shows the earlier steps worked.

| Actual (paste or describe) | Pass / Fail | Notes |
|---|---|---|
| `used: false; fail_reason: "ai_no_reply_status_404"; candidate_count: 10; reply: null; picked_ids: []; venues unchanged` | Pass | Model failure occurred exactly at the AI call and the pre-call setup remained intact. |

## Results summary (after running)

| Test | Cases | Passed | Failed | Notes |
|---|---|---|---|---|
| U1 (01, 02) | 2 | 2 | 0 | Both unit validation cases matched the expected success/failure behavior. |
| U2 (01) | 1 | 1 | 0 | Duplicate pick id 2 is now deduplicated and the remaining venues stay in original order. |
| U3 (01) | 1 | 1 | 0 | Output matched the 40-field whitelist and excluded hidden fields. |
| I1 (01) | 1 | 1 | 0 | Latest output meets every listed expectation, including `success: true` and no pick/nearby overlap. |
| I2 (01, 02) | 2 | 2 | 0 | Happy path and invalid-model failure both behaved as expected. |
| **Total** | **7** | **7** | **0** | **All recorded cases passed.** |

## What to send back

For each case: the actual output (or a screenshot), pass or fail, and anything surprising. For failures, do not edit the Expected column; write the actual result and the next step in Notes. I1 and I2 outputs must be scrubbed as described under **How to run**.
