# Genie / Xano Changelog

This file tracks changes to Genie’s Xano implementation commit by commit. Use `genie-workflow-architecture.md` for the current workflow, function responsibilities, and data flow.

## Working rules

- **Workspace:** Workspace 1, `Social Bees`.
- **Branch:** Make changes only on the intended sandbox/capstone branch. Do not modify live `v1` unless explicitly approved.
- **Branch-specific IDs:** Xano function and API IDs can differ between branches. Verify IDs against the branch being edited.
- **Shared data:** Xano tables and data may be shared across branches. Sandbox tests can create or modify rows in tables such as `genie_message`, `genie_query_log`, `genie_session`, and `genie_temp_sessions`.
- **Record each change:** Update the relevant `.xs` snapshot and this changelog, then commit them together.
- **Rollback:** Restore the previous `.xs` snapshot to the relevant Xano object, or use the Xano MCP `updateFunction` / `updateAPI` workflow.

## Change history

Newest first. Status and testing notes reflect the records available for each change. A successful sandbox test does not, by itself, prove deployment to production.

### 2026-10-11: Model-driven venue selection (branch `flutter-v2-sandbox-tamu-capstone`)

**Goal:** Move venue selection from a purely deterministic ranking/reply flow to a model-assisted step that chooses and explains picks from a verified candidate shortlist.

| # | Xano object (sandbox ID) | Type | Change | Why | Status | Tested |
|---|---|---|---|---|---|---|
| 15 | `genie/fn_genie_run_turn_dev` (verify current branch ID) | **new** | Orchestrates one model-driven selection turn: loads candidates, builds the prompt, calls the model, validates picks, composes the reply, and orders the selected venues. Returns result and diagnostic metadata, with failure handling. | Provides one entry point for the model-assisted selection workflow. | Added in the supplied `genie_model_call.xs` snapshot; branch deployment should be verified independently. | **Tested and working in Xano**, per the current project handoff. |
| 14 | `genie/fn_genie_order_venues_dev` (verify current branch ID) | **new** | Moves selected venue rows to the front of the list while preserving the row shape and remaining order. | Makes the displayed venue order match the model’s validated selections. | Added in the supplied snapshot; branch deployment should be verified independently. | **Tested and working in Xano**, per the current project handoff. |
| 13 | `genie/fn_genie_compose_reply_dev` (verify current branch ID) | **new** | Composes the user-facing reply from the model-generated introduction and validated pick reasons. | Keeps reply composition separate from model invocation and selection validation. | Added in the supplied snapshot; branch deployment should be verified independently. | **Tested and working in Xano**, per the current project handoff. |
| 12 | `genie/fn_genie_validate_picks_dev` (verify current branch ID) | **new** | Parses the model response and validates its selected venue IDs and reasons against the candidate list. | Prevents the model from selecting venue IDs that were not supplied to it and checks the expected response structure. | Added in the supplied snapshot; branch deployment should be verified independently. | **Tested and working in Xano**, per the current project handoff. |
| 11 | `genie/fn_genie_build_prompt_dev` (verify current branch ID) | **new** | Builds system and user prompt text using the message, candidates, detected language, city, and prompt type. The current `pick` prompt type supports the selection flow. | Centralizes prompt construction for the model-driven turn. | Added in the supplied snapshot; branch deployment should be verified independently. | **Tested and working in Xano**, per the current project handoff. |
| 10 | `genie/fn_genie_load_candidate_venues_dev` (verify current branch ID) | **new** | Loads full venue rows for the first N venue IDs in the existing ranked order, formats them for the model, and defaults to a maximum of 10 candidates. | Gives the model a bounded shortlist to choose from without replacing the existing retrieval logic. | Added in the supplied snapshot; branch deployment should be verified independently. | **Tested and working in Xano**, per the current project handoff. |
| 9 | `genie/fn_genie_format_venue_for_model_dev` (verify current branch ID) | **new** | Converts a venue row into a whitelist-based, model-safe representation. Excludes sensitive or irrelevant fields such as ownership, paid-placement tier, vendor, and `sb_*` fields. | Limits the data sent to the model to the fields needed for venue selection. | Added in the supplied snapshot; branch deployment should be verified independently. | **Tested and working in Xano**, per the current project handoff. |
| 8 | `genie/fn_genie_handle_message_v2_dev` (snapshot ID `1936`; verify current branch ID) | existing, feature | Changes the venue-results path to call `fn_genie_run_turn_dev` instead of the old commentary call. The handler uses the model result only when `used` is true; otherwise it preserves the existing fallback behavior. | Connects model-driven selection to the existing Genie message flow without making model success mandatory for a response. | Edited in the supplied `genie_model_call.xs` snapshot. The snapshot is not, by itself, proof of deployment; verify the target branch. | **Tested and working in Xano**, per the current project handoff. |
| 7 | `genie/fn_genie_call_ai_dev` (snapshot ID `1834`; verify current branch ID) | existing, reused | Reuses the shared OpenAI transport wrapper. The orchestrator supplies system/user messages and requests JSON mode. | Avoids duplicating OpenAI request handling in the new selection flow. | Reused by the new flow; verify the current branch’s object and deployment state before promotion. | **Tested and working in Xano** as part of the new flow, per the current project handoff. |

**Behavioral scope:** This is model-driven **selection from an app-provided shortlist**, not unrestricted model-driven search or a multi-call tool loop. Existing retrieval logic still produces the initial venue list. The supplied snapshot identifies the target branch as `flutter-v2-sandbox-tamu-capstone`; verify branch deployment and current Xano IDs before promoting or editing the objects.

### 2026-10-06: Genie LLM commentary (branch `feat/genie-llm-commentary`)

**Goal:** Genie now calls the model for supported cities (Houston). It writes a short intro plus one reason for each of the three picks. Before this, the model only ran for unsupported cities.

| # | Xano object (sandbox ID) | Type | Change | Why | Status | Tested |
|---|---|---|---|---|---|---|
| 6 | `genie/fn_detect_query_language_dev` (1387) | existing, fix | Rebuilt the `headers` array with `push` because the original had no comma between items; added an 8-second timeout. A second edit rewrote `params` as a plain object instead of a backtick expression. | Existing bug, not caused by the LLM work. Every first message of a session (`session_query_number <= 1`) returned HTTP 500 with PHP “Array to string conversion.” | Both edits recorded as **deployed**. Snapshot before the change: `9667cdc`. Attempted fix: `90fa9f6` (wip). | At the time of the original notes, `runWorkspaceFunction` still errored and the first query of each session still returned HTTP 500. Root cause was not found then; re-test before assuming the historical failure remains. |
| 5 | `genie/fn_genie_handle_message_dev` (1373) | existing, fix | Removed the “FIX 2” fallback query on `genie_user_social_profile.user_id`. | That column did not exist on the table (schema shared across branches; table changed 2026-09-30). Guest or new-user requests failed with `Unsupported parameter reference - xdo.user_id`. Live `v1` did not have this query. | **Deployed**, committed as `aaac920`. The deployed script was fetched back from Xano and matched the repo file exactly. | Handler returned `has_results` with 15 venues for `web_guest`. Runtime was about 13.4 seconds; this was already slow before the change. |
| 4 | `genie/fn_genie_handle_message_v2_dev` (1349) | existing, feature | Added step “4b”: when `reply_mode == has_results` and venues exist, call `fn_genie_llm_commentary_dev`. If it succeeds, replace the reply with commentary. Wrapped the call in `try_catch`. Kill switch: `$llm_commentary_enabled` (set to `false` to turn it off). Added `pick_reasons` and `llm` (`used`, `fail_reason`, `model`, `latency_ms`) response fields. | Connects the LLM to venue, event, neighborhood, and ambient results. | **Deployed**, committed as `f37a6a1`. Deployed script matched the repo file. | Sandbox endpoint, second query of a session: neighborhood request returned in about 3.0 seconds, with commentary for exactly the three shown picks. Venue request returned in about 16.5 seconds, also with correct picks. The first query of a session still failed at the time because of item #6. |
| 3 | `genie/fn_genie_llm_commentary_dev` (1550) | **new** | Sends only the top three picks (excluding ownership tags and paid-placement tier) to `gpt-4o-mini` in JSON mode. Returns `used`, `reply`, `pick_reasons`, `fail_reason`, `model`, and `latency_ms`. Rejects a result if a pick has no reason or the model returns a venue that was not supplied. | Implements the core LLM commentary feature. | **Deployed**, committed as `1e12a32`. | `runWorkspaceFunction`: English request completed in about 1.8–2.2 seconds; Spanish request was answered in Spanish; empty venues returned `no_picks`; a 1-second timeout returned `used=false`. |
| 2 | `genie/fn_genie_call_ai_dev` (1247) | existing, feature | Added optional `model`, `max_tokens`, `timeout`, and `json_mode` inputs. Also returns `model` and `latency_ms`. Defaults preserve old behavior (`gpt-4o`, 350 tokens, 30 seconds). | Allows commentary to use a faster model, JSON output, and a shorter timeout. | **Deployed**, committed as `ffccf78`. | Default call returned HTTP 200 in 1,962 ms. `gpt-4o-mini` with JSON mode returned HTTP 200 in 915 ms. |
| 1 | `ep_genie_chat_v2_dev` (API 3139) and seven functions | snapshot only | Exported a baseline snapshot; no Xano behavior change. | Provides the Git baseline and rollback copy. | Committed as `3882f2a`. | N/A. |

---

## Known issues and checks

These items were recorded in earlier testing notes. Re-test against the current branch before treating an old failure as still reproducible.

1. **OpenAI API key exposure in debug logs — security priority.** Earlier notes reported that `genie/fn_genie_detect_language_dev` (ID `1308` in that branch) logged the full OpenAI request, including its `Authorization: Bearer ...` header, under `LANG_DETECT_FULL_RAW`. If that logging is still present, remove sensitive header/body logging and rotate the exposed key. Ensure `fn_genie_call_ai_dev` does not return raw request details or secrets to clients on failure.
2. **Endpoint exception handling.** Earlier notes reported a broken catch expression in `ep_genie_chat_v2_dev` (`stack: $error.`), which caused an HTML/PHP fatal response instead of structured JSON. Verify the current endpoint and ensure exceptions return a safe JSON error.
3. **Frontend/API response fields.** Earlier notes reported that `ep_genie_chat_v2_dev` and `app/api/genie/message/route.ts` did not pass through `reply_mode`, `pick_reasons`, and `llm`. Check the current response contract and update both layers if the frontend needs those fields. Expose only the model diagnostics needed by the frontend.
4. **Language across turns.** Earlier notes reported that language detection occurred only on the first query of a session and later turns defaulted to English. Verify current behavior, especially for non-English follow-up messages.
5. **Latency.** Earlier testing recorded about 13 seconds in the existing venue handler before the old commentary/model step, with commentary adding around 1.5–2 seconds. Measure the current model-driven flow separately; old timings may no longer apply.
6. **Retrieval quality.** The model can only choose among the venues it receives. An earlier query for “cocktail bar for a date” returned Le Jardinier, The Breakfast Klub, and Notsuoh. The model can explain or rank a poor shortlist but cannot fix missing or irrelevant candidates on its own.
7. **Candidate-loading cost.** `fn_genie_load_candidate_venues_dev` loads full venue rows one ID at a time. Measure the impact if the shortlist size increases.
8. **Prompt and JSON validation.** The validator checks structure and candidate IDs, but that alone does not prove each reason is factually supported by venue fields. Keep the prompt restrictive and consider additional validation if unsupported claims become an issue.
9. **Shared-table side effects.** Sandbox tests may write to tables shared across branches. Use care when running tests that create sessions, messages, or query logs.

## Planned extensions (not current behavior)

These are future directions, not claims about current functionality:

- **Tool-calling loop:** Let the model request approved data-retrieval tools, execute them, return tool results to the model, and repeat until it returns a final answer. Bound the loop with iteration limits, timeouts, and error handling.
- **Model-driven retrieval:** Add tools such as venue search and venue detail lookup so the model can request additional candidates when the initial shortlist is insufficient.
- **Persistent user context:** Pass relevant saved preferences and prior-interaction notes into the prompt builder. Any read/write operations should be explicit, permission-checked, and bounded.
- **Shared prompt module:** Extend `fn_genie_build_prompt_dev` with additional prompt types when those prompts are actually migrated.
- **Additional fallback and observability:** Standardize failure reasons, record safe timing/usage metadata, and ensure a failed model call never prevents the legacy response from being returned.
- **Production promotion:** Remove `_dev` suffixes only as part of a deliberate promotion process, with snapshots, tests, and branch-specific ID verification.

## Entry template

Copy this template for each new change and place it at the top of the change history, below the heading. Remove fields that do not apply.

```markdown
### YYYY-MM-DD: Short change title (branch `branch-name`)

**Goal:** What behavior or issue is this change addressing?

| # | Xano object (sandbox ID) | Type | Change | Why | Status | Tested |
|---|---|---|---|---|---|---|
| 1 | `function_or_api_name` (ID) | new / existing, fix / existing, feature | What changed. | Why it changed. | Commit/deployment/snapshot status. | Inputs tested, outcomes, errors, and latency if useful. |

**Behavioral scope:** What changed for users, and what remains unchanged?
```
