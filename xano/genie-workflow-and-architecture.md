# Genie Workflow and Architecture

This document explains the current Genie request path, how the Xano functions communicate, and the boundary between deterministic retrieval and model-driven venue selection. Use `CHANGELOG.md` for commit-by-commit history, test records, known issues, and planned extensions.

> **Status note:** This describes the repository snapshots on `flutter-v2-sandbox-tamu-capstone`, not a verified live Xano deployment. Confirm the active branch and deployed function bodies in Xano before assuming every detail is live. Some functions called by the handler are not included in this repository snapshot.

## Current architecture

The v2 handler resolves the city and query mode, runs the request lifecycle for venue/event turns, and routes event, venue, neighborhood, and ambient requests. Event results are queried directly; an event request with no events switches to venue mode and continues through venue search. Venue results come from the request-first search and may be passed to a single model-driven selection turn. The model does **not** use an open-ended tool-calling loop.

### Request and response flow

```text
Frontend
  |
  | User message + session/context fields
  v
Frontend message route
  |
  | Sends request to Xano
  v
ep_genie_chat_v2_dev
  |
  | Creates/updates genie_temp_sessions
  | Invokes the handler and maps its response
  v
fn_genie_handle_message_v2_dev
  |
  +--> fn_genie_resolve_city_dev
  +--> query-mode, filter, weather, lifecycle,
  |    context, neighborhood, ambient, and reply helpers
  |
  +--> Event mode: query active future events
  |      |
  |      +--> no events: switch to venue mode
  |
  +--> Venue mode: fn_genie_search_venues_dev
  |      |
  |      +--> results: optionally call fn_genie_run_turn_dev
  |      |      +--> fn_genie_load_candidate_venues_dev
  |      |      |      +--> fn_genie_format_venue_for_model_dev
  |      |      +--> fn_genie_build_prompt_dev
  |      |      +--> fn_genie_call_ai_dev --> OpenAI
  |      |      +--> fn_genie_validate_picks_dev
  |      |      +--> fn_genie_compose_reply_dev
  |      |      +--> fn_genie_order_venues_dev
  |      |
  |      +--> no results/error: handler reply fallback
  |
  +--> Enrich results, persist city, write analytics
  v
Xano API response
  |
  | Endpoint returns reply, venues/events, modes, session data
  v
Frontend
```

The handler's helper calls are shown by role where the function snapshots are missing from this repository. The endpoint creates or updates a `genie_temp_sessions` row and passes its ID to the handler; the handler's lifecycle separately manages the Genie user/session/message records and analytics.

### What happens when a user sends a message?

1. The endpoint accepts the chat request, creates a session token when absent, updates its temporary session metadata, and calls `fn_genie_handle_message_v2_dev`.
2. The handler resolves a supported city and whether the supplied coordinates belong to that city. If it cannot resolve a usable city, it returns a structured location response early.
3. The handler detects query mode and attempts model-based filter extraction. Weather context is obtained before request routing.
4. Venue and event turns call `fn_genie_request_lifecycle_dev` once to identify the user, manage the Genie session, log the message, and produce intake/filter metadata.
5. Event mode queries active events for the resolved city from today onward, ordered by date and limited to ten. If none are found, it switches to venue mode and searches for venues; the final reply is prefixed to explain that no events were found.
6. Venue mode can load user context, then calls `fn_genie_search_venues_dev` with request-derived filters. The function returns model-safe venue candidates, display cards, match quality, and diagnostics. The handler currently passes several undeclared inputs (`preference_keywords`, `avoid_keywords`, `lat`, `lng`, `radius_m`, and `language`); the search snapshot does not consume them.
7. When venue search returns cards, the handler can call `fn_genie_run_turn_dev`. It loads full venue rows for the candidates, formats a model-safe whitelist, builds a prompt, calls OpenAI in JSON mode, validates the selected IDs, composes the reply, and orders the venue rows. The handler currently passes `user_context` to `fn_genie_run_turn_dev`, but that input is undeclared and is not forwarded to the prompt builder.
8. The handler uses the model reply and reordered venues only when the model turn succeeds. On model failure it retains the existing reply and order; search failures are reported as `reply_mode: "search_error"`.
9. The handler enriches events with venue records, finalizes the reply, persists the resolved city where possible, and calls turn analytics once when lifecycle ran.
10. The endpoint forwards the handler result, including `success`, reply, venues, events, modes, and session identifiers. Diagnostic blocks are included only when `debug` is true; thrown errors are logged and rethrown.

### Important boundaries

- **Xano creates the shortlist.** `fn_genie_search_venues_dev` loads and ranks city venues; the model chooses among candidates supplied by that search and does not independently query the database.
- **The model does not invent venue records.** Its selected IDs must come from the candidate list.
- **The safe venue formatter is a privacy/product boundary.** Only fields explicitly included in `fn_genie_format_venue_for_model_dev` are sent to the model. Paid-placement, ownership/community, vendor/monetization, and `sb_*` fields are intentionally excluded.
- **The fallback remains authoritative when AI fails.** A failed model call should not erase the existing response or change the venue order.
- **The current model turn is a single selection call.** There is no open-ended tool loop.
- **No-event behavior decision:** When an event query returns no events, the handler switches to venue mode and searches venues (option b), rather than returning event mode with venues attached. During frontend retesting, verify that the UI handles `query_mode: "venue"` and the reply's no-events explanation as intended.
- **Snapshot contract mismatches need verification.** The handler currently passes fields to `fn_genie_search_venues_dev` that its declared inputs do not include (`preference_keywords`, `avoid_keywords`, `lat`, `lng`, `radius_m`, and `language`). It also passes `user_context` to `fn_genie_run_turn_dev`, which is not declared there. The search function does not read the extra inputs; `run_turn` does not read `user_context`. The handler also does not pass the prompt builder's optional `now_text` or `weather_text`, so these prepared contexts do not currently reach model selection. Confirm Xano's call behavior and align the intended contracts before relying on these features.

---

## Current function reference

The function names below use the sandbox/capstone naming convention with the `_dev` suffix. IDs are branch-specific; confirm them in Xano before using an ID in an update.

### Model-driven venue selection functions

| Function | Purpose | Inputs / outputs | Called by |
|---|---|---|---|
| `genie/fn_genie_format_venue_for_model_dev` | Converts one `genie_venues` row into a model-safe object using an explicit field whitelist. Computes open status when needed and omits empty/unavailable fields. | Inputs: `venue`, optional `open_info`. Output: whitelisted venue object with ID, name, location/details, ratings, computed hours, and available tags/features. | `fn_genie_load_candidate_venues_dev`; `fn_genie_search_venues_dev` |
| `genie/fn_genie_load_candidate_venues_dev` | Takes the existing ranked venue list, uses its IDs to load full rows from `genie_venues`, formats each row for the model, and preserves ranked order. | Inputs: `venues`, optional `max_candidates` (default 10). Output: `candidate_ids`, `candidates`, and `fail_reason` (`no_candidates` when nothing loads). | `fn_genie_run_turn_dev` |
| `genie/fn_genie_build_prompt_dev` | Builds the system and user prompt text for the model. The current prompt type is `pick`. | Inputs: required `message`, optional `prompt_type`, `candidates`, `city`, `now_text`, `weather_text`, and `match_quality`. Output: `system_text`, `user_text`, `prompt_version`, and `fail_reason`. | `fn_genie_run_turn_dev` |
| `genie/fn_genie_validate_picks_dev` | Parses the model's JSON response and validates the selected venue IDs and reasons against the candidates provided to the model. Rejects invalid JSON, unknown IDs, and too few valid picks. | Inputs: `raw_reply`, `candidates`, optional `max_picks` (default 3). Output: `valid`, `intro`, validated `picks`, and `fail_reason`. | `fn_genie_run_turn_dev` |
| `genie/fn_genie_compose_reply_dev` | Converts the model's validated intro and picks into the plain-text reply displayed in chat. Keeps the reply format in one place. | Inputs: optional `intro`, `picks`. Output: a text reply with the intro and numbered venue/reason lines. | `fn_genie_run_turn_dev` |
| `genie/fn_genie_order_venues_dev` | Moves model-selected venue rows to the front in the model's chosen order. Appends unselected rows in their original order and leaves each row's shape unchanged. | Inputs: `venues`, `picked_ids`. Output: reordered venue list. | `fn_genie_run_turn_dev` |
| `genie/fn_genie_run_turn_dev` | Orchestrates one model-driven venue-selection turn: candidate loading, prompt building, AI call, validation, reply composition, and venue ordering. | Inputs: required `message`, `venues`; optional `city`, `now_text`, `weather_text`, `match_quality`, model/timeout/token/candidate options, and `prompt_type`. Output includes `used`, `reply`, `pick_reasons`, `picked_ids`, ordered `venues`, `candidate_count`, `fail_reason`, `model`, `prompt_version`, `latency_ms`, and `reason_flags`. | `fn_genie_handle_message_v2_dev` |
| `genie/fn_genie_call_ai_dev` | Shared OpenAI request wrapper. Sends the prepared chat messages to the configured model and returns the model response plus request metadata. | Inputs include `ai_payload` and optional `model`, `max_tokens`, `timeout`, and `json_mode`. Returns `assistant_reply`, `status_code`, `model`, `latency_ms`, and error information. | `fn_genie_run_turn_dev`; also used by existing AI-powered functions |
| `genie/fn_genie_search_venues_dev` | Loads active venues for a city, excludes unsuitable records, applies optional filters, ranks matches, and returns model-safe candidates plus app cards and diagnostics. | Required `city_id`; optional `venue_type`, `cuisine`, `neighborhood`, `price_band`, `meal_service`, `open_now`, `keywords`, `energy`, `sort_by`, `limit`, and `min_results`. It does not declare the extra personalization/location/language inputs currently passed by the handler. | `fn_genie_handle_message_v2_dev` |

### Existing request-path functions

| Function / API | Purpose |
|---|---|
| `ep_genie_chat_v2_dev` | Xano API entry point. Creates/updates the temporary endpoint session, invokes the v2 handler, forwards its response fields, optionally includes diagnostics when `debug` is true, and logs/rethrows endpoint errors. |
| `genie/fn_genie_handle_message_v2_dev` | Main request router. Resolves city/mode, runs lifecycle for event and venue turns, directly queries events, falls back to venue search when no events match, enriches results, optionally runs model picks, and records analytics. |
| `genie/fn_genie_request_lifecycle_dev` | Identifies the user, gets/creates the Genie session, logs the message, and returns intake/profile/rules-filter metadata. Its own failures are returned in `ok`/`error`; the handler currently does not gate search on `ok`. |
| `genie/fn_genie_resolve_city_dev` | Resolves the supported city and determines whether device coordinates apply to it. |
| `genie/fn_genie_log_turn_analytics_dev` | Writes query-log and behavior-signal analytics after the final mode and result count are known. The handler calls it once when lifecycle ran. |

The repository snapshot does not include source for several helper functions directly called by the v2 handler: `fn_genie_detect_query_mode_dev`, `fn_genie_extract_search_filters_dev`, `fn_genie_update_handle_message_weather_dev`, `fn_genie_get_neighborhood_context_dev`, `fn_genie_get_neighborhood_venues_dev`, `fn_genie_get_reply_v2_dev`, `fn_genie_get_ambient_recommendations_dev`, and `fn_genie_resolve_user_context_dev`. The lifecycle/analytics chain also calls `fn_genie_identify_user_dev` and `fn_genie_write_behavior_signal_dev`, whose source is not present in this functions folder. Verify those deployed contracts in Xano or add their snapshots before relying on a complete dependency audit.

---

## Model prompt and response contract

### Input sent to the model

`fn_genie_run_turn_dev` passes two messages to `fn_genie_call_ai_dev`:

- **System message:** Built by `fn_genie_build_prompt_dev`. It tells Genie to choose the best available venues, follow the user's language, write a short intro and one concise reason per pick, use only supplied venue IDs, and avoid inventing facts.
- **User message:** The prompt builder supports the user's request, city, optional local time, optional weather, optional match quality, and candidate venues serialized as JSON. In the current handler call, only request, city, match quality, and candidates are wired through; local time and weather are not passed, and the extra `user_context` argument is not part of the `run_turn` input contract.

The orchestrator requests JSON mode. The current response contract is:

```json
{
  "intro": "One short introductory sentence.",
  "picks": [
    {
      "venue_id": 123,
      "reason": "One concise sentence explaining why this venue fits."
    }
  ]
}
```

The model's `venue_id` values are checked against the candidate list. The validator resolves each ID to its candidate venue name, filters duplicate IDs, requires a non-empty reason, and fails the whole selection if an unknown venue ID is returned or too few valid picks remain.

### Successful response

When the model-driven step succeeds, `fn_genie_run_turn_dev` returns:

- `used: true`
- `reply`: composed intro and numbered picks
- `pick_reasons`: validated picks, including IDs, names, and reasons
- `picked_ids`: selected venue IDs in model order
- `venues`: original venue rows reordered to show selected venues first
- `candidate_count`, `model`, and `latency_ms`

The handler uses those fields to replace its fallback reply and venue ordering.

### Failure and fallback behavior

If no candidates load, prompt construction fails, the model returns no response, the response is invalid, or validation fails, the orchestrator returns `used: false`, a `fail_reason`, a null reply, empty pick metadata, and the original venue order. The caller is expected to preserve its existing reply. The handler also wraps the orchestration call in `try_catch` so an exception does not replace the fallback response.

---
