## Unit & Integration Testing Checkpoint

**Files:** test plan with expected results (written October 13, 2026, before any test was run): `tests/genie-test-plan.md`. Tests were run in the Xano run panel, and each actual result was compared by hand against the expected result in the plan. 

### Units under test and test boundaries

| Test | Unit under test | Kept outside the test |
|---|---|---|
| U1 | `fn_genie_validate_picks_dev` | the model, the database, every other function (it receives canned model text) |
| U2 | `fn_genie_order_venues_dev` | the database, the model, every other function |
| U3 | `fn_genie_format_venue_for_model_dev` | the database (the venue row is passed in), the model |

### Test cases, expected and actual results

| Test | What it does | Expected | Actual | Result |
|---|---|---|---|---|
| U1-01 | Valid model reply with three known venue ids | `valid` true, `fail_reason` null, intro "Here are three spots.", picks 101, 103, 102 in that order with names from the candidates | `valid` true, `fail_reason` null, intro "Here are three spots.", picks 101, 103, 102 with names Alpha Bar, Gamma Grill, Beta Lounge | Pass |
| U1-02 | Model reply that includes id 999, which is not a candidate | `valid` false, `fail_reason` `unknown_venue_id`, `picks` empty | `valid` false, `fail_reason` `unknown_venue_id`, `picks` `[]` | Pass |
| U2-01 | Same id picked twice (`picked_ids` of `[2, 2]`) | Each venue once, ids in order 2, 1, 3, 4, 5 (5 rows) | ids 2, 1, 3, 4, 5 (5 rows) | Pass |
| U3-01 | Full venue row that includes fields the model must not see | Exactly 40 whitelisted keys, none of the 20 hidden fields, correct renamed values | 40 keys, none of the 20 hidden fields present, `venue_id` 618, `neighborhood` Central Business District, `rating` 4.5, `rating_count` 379, `brunch` true, `happy_hour` true, `late_night` false, `has_dj` true, `good_for_dates` true | Pass |

### How inputs are controlled and what is inspected

- **U1:** the model's reply is an input (`raw_reply`) along with the candidate list, so any model answer, including an invented venue id, can be replayed with no model call. I inspect `valid`, `fail_reason`, and the order and names in `picks`.
- **U2:** the venue list and `picked_ids` are inputs. I inspect the order of `id` values and the row count, including whether venue 2 appears twice.
- **U3:** one venue row is the input, built to contain both whitelisted and hidden fields. I count the keys in the output and search it for each hidden field name.

### Design decisions behind these tests

- **Easier to control:** `fn_genie_validate_picks_dev` takes the model's raw text and the candidate list as inputs instead of calling the model itself. In U1-02 this let me hand it a reply with an invented venue id (999) on demand. A real model almost never produces that, so it would be hard to test otherwise.
- **Easier to observe:** the validator returns `valid` and a named `fail_reason` (`empty_reply`, `invalid_json`, `unknown_venue_id`, `too_few_valid_picks`) instead of throwing. In U1-02 the result says `unknown_venue_id` and `picks` is empty even though two of the three ids were good, so the cause is visible in the output without reading logs.

Together these help expose errors early: an invented venue id is caught and named at the validator, before it can reach the composer, the orderer or the user.

### Results and next steps

All four unit cases passed in the recorded runs. The tests compare results by hand against the plan. The next step is to turn the four cases into automated assertions so they can be rerun after every change.

---

## Integration Testing Checkpoint

**Files:** same as above. Integration tests use the real OpenAI API, so the model's exact picks are not fixed. The expected results check properties (counts, ids inside the candidate window, ordering, format), not specific venues.

### Components under test and the interaction

| Test | Components | Interaction being tested |
|---|---|---|
| I2-01, I2-02 | `fn_genie_run_turn_dev` with its loader, formatter, prompt builder, `fn_genie_call_ai_dev`, validator, composer and orderer | A fixed list of 15 venues goes in, the first 10 are shown to the model, the model's reply is validated, composed and used to reorder the list. I2-02 forces the model call to fail and checks that the earlier steps still ran and the list comes back untouched. |
| I1-01 | `ep_genie_chat_v2_dev`, router (`fn_genie_handle_message_v2_dev`), handler (`fn_genie_handle_message_dev`), model step (`fn_genie_run_turn_dev`) | A venue request goes through the router, the handler builds the venue list and `more_nearby_venues`, the model step picks three, and the endpoint merges them into one response. |

Outside the boundary: the frontend. OpenAI is real. For I2, the router, handler and endpoint are also outside.

### Test cases, expected and actual results

**I2-01: happy path (`run_turn`)**

| Expected | Actual | Result |
|---|---|---|
| `used` true, `fail_reason` null, `model` gpt-4o, `latency_ms` > 0 | true, null, gpt-4o, 2450 | Pass |
| `candidate_count` is 10 | 10 | Pass |
| 3 distinct `picked_ids`, all in the candidate window, none from 1037, 749, 415, 1056, 1141 | 714, 437, 529, all in the window | Pass |
| `pick_reasons` has 3 items matching `picked_ids` in order, with names and reasons | 714 La Carafe, 437 Lyric Bar, 529 Tom's Watch Bar, in the same order as `picked_ids` | Pass |
| `reply` has an intro line then lines starting `1. `, `2. `, `3. ` | intro line then 1. La Carafe, 2. Lyric Bar, 3. Tom's Watch Bar | Pass |
| `venues` has 15 rows, the first 3 equal `picked_ids`, the other 12 keep their original order | 15 rows, first 3 are 714, 437, 529, the other 12 are in original order | Pass |

**I2-02: model call fails (`model` set to `not-a-real-model`)**

| Expected | Actual | Result |
|---|---|---|
| `used` false | false | Pass |
| `fail_reason` starts with `ai_no_reply_status_` | `ai_no_reply_status_404` | Pass |
| `candidate_count` is 10 | 10 | Pass |
| `reply` null, `pick_reasons` and `picked_ids` empty | null, `[]`, `[]` | Pass |
| `venues` identical to the input list (15 rows, same order) | identical | Pass |
| `model` is `not-a-real-model` | `not-a-real-model` | Pass |

**I1-01: venue request through the whole endpoint** (same input both runs: `session_query_number` 2, test user `test-user-1`)

| Expected (fixed before running) | Actual | Result |
|---|---|---|
| `success` true | true | Pass |
| `query_mode` venue, `reply_mode` has_results | venue, has_results | Pass |
| `venues` has 3 to 15 rows | 15 | Pass |
| `llm.used` true, `llm.fail_reason` null, `llm.model` gpt-4o | true, null, gpt-4o | Pass |
| `pick_reasons` has exactly 3 items | 3 (636 Le Jardinier, 922 The Honey Hole, 612 Notsuoh) | Pass |
| First 3 `venues` ids equal the `pick_reasons` ids in order | 636, 922, 612: match | Pass |
| Every `pick_reasons` id is also in `venues` | yes | Pass |
| `reply` has an intro line then lines starting `1. `, `2. `, `3. ` | yes | Pass |
| `weather_context_text` starts with `WEATHER CONTEXT` | "WEATHER CONTEXT: Current conditions in this city: 90.64°F, Clouds. Precipitation probability: 13%." | Pass |
| No picked id appears in `more_nearby_venues` | 11 nearby venues (572, 763, 983, 1071, 1072, 1055, 1056, 1058, 1073, 1074, 1083), none are picks | Pass |

### How inputs are controlled and what is inspected

- **I2:** the venue list, `message`, and city are fixed inputs, and `model` and `max_candidates` can be set per run. I2-02 sets `model` to a name that does not exist to force a failure at the model call without changing any code. In both cases I inspect `used`, `fail_reason`, `candidate_count`, `picked_ids`, `latency_ms` and the order of `venues`.
- **I1:** the request body (message, user, session token, query number) is fixed. I cannot control which venues the handler returns or which three the model chooses, so the test checks properties of the response, not exact picks.

### Intermediate observations

- **I2-01:** `candidate_count` of 10 shows the loader and window worked. `picked_ids` checked against the window shows the model only chose from what it was shown. `latency_ms` of 2450 shows a real model call happened.
- **I2-02:** `fail_reason` `ai_no_reply_status_404` shows the stop was at the model call, and `candidate_count` of 10 shows the loader and prompt steps had already worked. `latency_ms` of 508 (not 0) is consistent with a call that was attempted and rejected.
- **I1-01:** `query_mode` and `reply_mode` show the router and handler worked. `weather_context_text` shows the weather step worked. The `llm` block and `pick_reasons` show the model step worked. The order of `venues` shows the merge worked. 

### Interaction risk, design decisions, and how they connect to the tests

- **Likely risk in the interaction:** `more_nearby_venues` is built by the handler from its own list before the model step runs, so it can repeat a venue the model then picks. 
- **Easier to control:** `fn_genie_run_turn_dev` exposes `model` and `max_candidates` as inputs. I2-02 uses `model` to force a model failure without touching the code or waiting on a real API error.
- **Easier to observe:** `run_turn` returns `used`, `fail_reason`, `candidate_count`, `picked_ids` and `latency_ms` instead of throwing, and the endpoint passes the `llm` block and `pick_reasons` through to its response. In I2-02, `fail_reason` and `candidate_count` together show which step stopped. In I1-01, the passed-through `pick_reasons` could be compared directly against `more_nearby_venues`.

### Results and next steps
 
All three cases passed in the recorded runs. The tests compare results by hand against the plan. The next step is to turn the three cases into automated assertions so they can be rerun after every change.
