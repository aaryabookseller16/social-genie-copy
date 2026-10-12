# Genie Workflow and Architecture

This document explains the current Genie request path, how the Xano functions communicate, and the boundary between existing deterministic retrieval and the model-driven venue-selection step. Use `changelog.md` for commit-by-commit history, test records, known issues, and planned extensions.

> **Status note:** This documentation is based on the available Xano snapshot and project handoff. The model-driven functions have been tested in Xano according to the handoff, but the snapshot labels the changes as a draft. Confirm the active branch, deployed function bodies, and branch-specific IDs in Xano before assuming every detail is live.

## Current architecture

Genie currently uses an existing deterministic request handler to retrieve and prepare results, with an optional model-driven selection step for venue recommendations. The new model-driven functions let the model select and explain venues from a shortlist prepared by the app. They do **not** yet make the entire backend a fully autonomous agent with an open-ended tool-calling loop.

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
  | Receives the chat request and invokes the handler
  v
fn_genie_handle_message_v2_dev
  |
  | Existing request processing:
  | session / query handling, query-mode routing,
  | venue retrieval, and existing fallback response
  |
  | For supported venue results, calls the model-driven turn
  v
fn_genie_run_turn_dev
  |
  +--> fn_genie_load_candidate_venues_dev
  |       |
  |       +--> fn_genie_format_venue_for_model_dev
  |
  +--> fn_genie_build_prompt_dev
  |
  +--> fn_genie_call_ai_dev
  |       |
  |       +--> OpenAI chat-completions request
  |
  +--> fn_genie_validate_picks_dev
  |
  +--> fn_genie_compose_reply_dev
  |
  +--> fn_genie_order_venues_dev
  |
  v
fn_genie_handle_message_v2_dev
  |
  | Uses model reply and reordered venues if the model step succeeds.
  | Keeps the existing reply and venue order if it fails.
  v
Xano API response
  |
  | Frontend displays reply and venue cards
  v
Frontend
```

The diagram describes the intended/current function chain represented by the Xano snapshots. The frontend route is part of the end-to-end request path; the exact fields passed through every frontend/API layer should be checked in the corresponding frontend source before changing the response contract.

### What happens when a user sends a message?

1. The frontend sends the user's message and available session/context fields to its message route, which calls `ep_genie_chat_v2_dev`.
2. The endpoint calls `fn_genie_handle_message_v2_dev` to process the request.
3. The existing handler determines the request path and prepares the venue results and fallback reply using the existing retrieval and response logic.
4. When the request is a venue query with results, the handler can call `fn_genie_run_turn_dev`.
5. The orchestrator takes the already-ranked venue rows and loads full venue records for a limited candidate list. It formats those records into a safe, explicit field whitelist before sending them to the model.
6. The prompt builder creates the system and user messages. The user message contains the user's request, city, and candidate venues as JSON.
7. `fn_genie_call_ai_dev` sends those messages to OpenAI. The orchestrator requests JSON mode and receives the model's response.
8. The validation function parses the JSON and rejects invalid responses, including venue IDs not present in the supplied candidate list or an insufficient number of valid picks.
9. If valid, the reply composer builds the text shown to the user, and the ordering function moves the selected venues to the front while preserving the original row shape.
10. The handler uses the model-generated reply and reordered venues only if the model step succeeds. If the step fails or throws an exception, it retains the existing reply and venue order.

### Important boundaries

- **The app still creates the shortlist.** The model chooses among venues supplied by Xano; it does not independently search the entire venue database.
- **The model does not invent venue records.** Its selected IDs must come from the candidate list.
- **The safe venue formatter is a privacy/product boundary.** Only fields explicitly included in `fn_genie_format_venue_for_model_dev` are sent to the model. Paid-placement, ownership/community, vendor/monetization, and `sb_*` fields are intentionally excluded.
- **The fallback remains authoritative when AI fails.** A failed model call should not erase the existing response or change the venue order.
- **The current model turn is a single selection call.** A bounded multi-step tool-calling loop, persistent user context, and model-selected retrieval tools are future extensions unless separately implemented.

---

## Current function reference

The function names below use the sandbox/capstone naming convention with the `_dev` suffix. IDs are branch-specific; confirm them in Xano before using an ID in an update.

### Model-driven venue selection functions

| Function | Purpose | Inputs / outputs | Called by |
|---|---|---|---|
| `genie/fn_genie_format_venue_for_model_dev` | Converts one `genie_venues` row into a model-safe object containing only approved venue fields. Excludes paid-placement, ownership/community, monetization/vendor, and `sb_*` fields. | Input: `venue` JSON row. Output: whitelisted venue object with ID, name, neighborhood, type, address, summaries, vibe, rating, hours, tags, features, and other approved attributes. | `fn_genie_load_candidate_venues_dev` |
| `genie/fn_genie_load_candidate_venues_dev` | Takes the existing ranked venue list, uses its IDs to load full rows from `genie_venues`, formats each row for the model, and preserves ranked order. | Inputs: `venues`, optional `max_candidates` (default 10). Output: `candidate_ids`, `candidates`, and `fail_reason` (`no_candidates` when nothing loads). | `fn_genie_run_turn_dev` |
| `genie/fn_genie_build_prompt_dev` | Builds the system and user prompt text for the model. The current prompt type is `pick`. | Inputs: `message`, optional `prompt_type`, `candidates`, `detected_language`, and `city`. Output: `system_text`, `user_text`, and `fail_reason`. | `fn_genie_run_turn_dev` |
| `genie/fn_genie_validate_picks_dev` | Parses the model's JSON response and validates the selected venue IDs and reasons against the candidates provided to the model. Rejects invalid JSON, unknown IDs, and too few valid picks. | Inputs: `raw_reply`, `candidates`, optional `max_picks` (default 3). Output: `valid`, `intro`, validated `picks`, and `fail_reason`. | `fn_genie_run_turn_dev` |
| `genie/fn_genie_compose_reply_dev` | Converts the model's validated intro and picks into the plain-text reply displayed in chat. Keeps the reply format in one place. | Inputs: optional `intro`, `picks`. Output: a text reply with the intro and numbered venue/reason lines. | `fn_genie_run_turn_dev` |
| `genie/fn_genie_order_venues_dev` | Moves model-selected venue rows to the front in the model's chosen order. Appends unselected rows in their original order and leaves each row's shape unchanged. | Inputs: `venues`, `picked_ids`. Output: reordered venue list. | `fn_genie_run_turn_dev` |
| `genie/fn_genie_run_turn_dev` | Orchestrates one model-driven venue-selection turn. Calls candidate loading, prompt building, the AI wrapper, validation, reply composition, and venue ordering. It contains the sequence and failure handling rather than the prompt or parsing rules themselves. | Inputs: `message`, `venues`, optional language/city/model/timeout/token/candidate/prompt settings. Output: `used`, `reply`, `pick_reasons`, `picked_ids`, `venues`, `candidate_count`, `fail_reason`, `model`, and `latency_ms`. | `fn_genie_handle_message_v2_dev` |
| `genie/fn_genie_call_ai_dev` | Shared OpenAI request wrapper. Sends the prepared chat messages to the configured model and returns the model response plus request metadata. | Inputs include `ai_payload` and optional `model`, `max_tokens`, `timeout`, and `json_mode`. Returns `assistant_reply`, `status_code`, `model`, `latency_ms`, and error information. | `fn_genie_run_turn_dev`; also used by existing AI-powered functions |

### Existing request-path functions

| Function / API | Purpose |
|---|---|
| `ep_genie_chat_v2_dev` | Xano API entry point for Genie chat requests. Receives frontend requests and invokes the message handler. Its response must preserve the fields the frontend needs. |
| `genie/fn_genie_handle_message_v2_dev` | Main Genie request handler. Runs the existing request/query processing, obtains venue results and a fallback reply, and conditionally invokes the model-driven selection step. On model success, it replaces the reply and venue order with the model output; on failure, it keeps the existing output. |
| `genie/fn_genie_detect_query_language_dev` | Detects the language used for a query. Historical fixes were attempted for malformed request construction and parameter formatting; see the change history and outstanding issues. |
| `genie/fn_genie_llm_commentary_dev` | Earlier LLM feature that generated an intro and a reason for each of the three already-selected venues. It is retained as a possible rollback path, but the new model-driven flow is intended to replace its role in the handler. |

Other functions called by the legacy handler—such as retrieval, query-mode routing, neighborhood/ambient lookup, and reply-bank functions—remain part of the existing flow. Their precise names and call order should be documented from their current `.xs` snapshots rather than inferred from this summary.

---

## Model prompt and response contract

### Input sent to the model

`fn_genie_run_turn_dev` passes two messages to `fn_genie_call_ai_dev`:

- **System message:** Built by `fn_genie_build_prompt_dev`. It tells Genie to choose the best available venues, follow the user's language, write a short intro and one concise reason per pick, use only supplied venue IDs, and avoid inventing facts.
- **User message:** Includes the user's request, city, and the model-safe candidate venues serialized as JSON.

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
