# Xano change log

Every change this repo makes to Xano, newest first. Xano has no commit history, so this file and the `.xs` snapshots in `flutter-v2-sandbox-tamu-capstone/` and `flutter-v2-sandbox/` are the record.

**Rules**
- Workspace 1 ("Social Bees"). Capstone work goes to branch `flutter-v2-sandbox-tamu-capstone`. Never write to live `v1`.
- Function IDs belong to one branch. The same function has a different ID on each branch (for example, `fn_genie_call_ai_dev` is 1834 on capstone, 1247 on the sandbox and 26 on `v1`).
- Tables and data are shared by all branches. Sandbox test requests write real rows (`genie_message`, `genie_query_log`, `genie_session`, `genie_temp_sessions`) into the same database as `v1`.
- For each change: update the `.xs` snapshot, add a row here, and commit both together.
- To roll back: paste the `.xs` file from the commit before the change back into the object in Xano, or use `updateFunction` / `updateAPI` through the Xano MCP.

**Status values**
- `deployed`: live on the branch in Xano.
- `local only`: edited in the repo, not pushed to Xano.
- `committed`: the snapshot is in git (with commit hash).

## 2026-10-12: User context model, GEN-010/011/012 (branch `feat/gen-010-012-user-context`)

Goal: one `genie_user_context` row per user (or per device before signup) holding a JSON preference document, with stated-beats-inferred, tombstone removals and version checks. Table `genie_user_context` (242) already existed and is shared with `v1`; only capstone functions read it.

| # | Branch | Xano object (ID) | Change | Status | Tested |
|---|---|---|---|---|---|
| 12 | capstone | `fn_genie_render_user_context_dev` (2096, new) | Renders the document as `User preferences:\n- <category>: a, b (learned)`. Only `active`/`user_edited`. Sensitive entries need a `consent_ref`. Profile (age, gender) never rendered. Format provisional until GEN-053. | **deployed** | Mixed context: only Black-Owned (consented), Patio, Karaoke (learned) shown; R&B without consent, tombstoned Rooftop, expired Brunch and gender left out. Empty input → `""`, count 0 (first version crashed; fixed with an `is_array` guard). |
| 11 | capstone | `fn_genie_update_user_context_dev` (2061) | Filled the stub. Takes `expected_version`, `ops[]` (add/remove) and optional `onboarding`. Stale version → input error. Stated beats inferred. Remove is a `user_removed` tombstone that only a stated add can undo. community/music are `sensitive`. Bumps `version`. Note: ternaries inside object literals and `get` defaults on missing keys returned null in testing, so the function uses separate vars. | **deployed** | On `gen010-test-device-2`: v1 adds → 3 entries with all fields, `bogus` op skipped. Stale v1 write rejected. v2: Rooftop tombstoned, inferred Karaoke reinforced (evidence 2, confidence kept 0.6), inferred R&B skipped `stated_wins`. v3: inferred Rooftop (0.95) skipped `tombstoned`, onboarding saved. |
| 10 | capstone | `fn_genie_get_user_context_dev` (2062), `fn_genie_create_user_context_dev` (2059) | Filled the empty stubs. Get looks up the active row by user_id, else by device_id with genie_user_id = 0. Create is idempotent and starts `{schema:1, preferences:[], profile:{}, onboarding:{}}` at version 1. | **deployed** | Get on unknown device: null. Create with no inputs: input error. Create on `gen010-test-device` twice: same row id 1. Get: returns it. Test row deleted after the GEN-010 tests. |

## 2026-10-08: Move the Genie LLM work to `flutter-v2-sandbox-tamu-capstone` (branch `chore/xano-move-llm-to-capstone`)

The capstone branch was cloned from `flutter-v2-sandbox` on 2026-10-08 00:24 UTC, so it already had changes #2–#6 below. The sandbox was then rolled back.

| # | Branch | Xano object (ID) | Change | Status | Tested |
|---|---|---|---|---|---|
| 9 | capstone | `fn_genie_call_ai_dev` (1834), `fn_genie_llm_commentary_dev` (2057), `fn_genie_handle_message_v2_dev` (1936), `fn_genie_handle_message_dev` (1960) | No change. They already match #2–#5. | snapshots in `flutter-v2-sandbox-tamu-capstone/`, committed `c581194` | Commentary run: `used=true`, 3 reasons, 2.9s. v2 handler, 2nd query, Montrose: `llm.used=true`, 3 `pick_reasons`, 2.6s. |
| 8 | capstone | `fn_detect_query_language_dev` (1974) | #6 (the failing WIP fix) dropped. Restored to the original from `9667cdc`. | **deployed**, committed `c581194` | Fetched back; matches `9667cdc`. The 1st query of a session still fails, as before this work. |
| 7 | sandbox | 1349, 1247, 1387; 1550 deleted | v2 handler and `call_ai` restored to `3882f2a`; language detector restored to `9667cdc`; `fn_genie_llm_commentary_dev` deleted. `fn_genie_handle_message_dev` (1373) **keeps** the #5 fix on purpose, because the original crashes every guest request. | **deployed**, committed `335d9de` | Search for `commentary` on the sandbox returns nothing. v2 handler, 2nd query, Montrose: reply-bank text, no `llm` field, 1.05s. |

## 2026-10-06: Genie LLM commentary (branch `feat/genie-llm-commentary`; sandbox IDs, moved to capstone on 2026-10-08)

Goal: Genie now calls the model for supported cities (Houston). It writes a short intro plus one reason for each of the 3 picks. Before this, the model only ran for unsupported cities.

| # | Xano object (sandbox ID) | Type | Change | Why | Status | Tested |
|---|---|---|---|---|---|---|
| 6 | `genie/fn_detect_query_language_dev` (1387) | existing, fix | 1st edit: `headers` array rebuilt with `push` (the original had no comma between items) and an 8s timeout. 2nd edit: `params` rewritten as a plain object instead of a backtick expression. | Existing bug, not caused by the LLM work. Every first message of a session (`session_query_number <= 1`) returned HTTP 500 with PHP "Array to string conversion". | Both edits **deployed**. Snapshot before the change: `9667cdc`. Attempted fix: `90fa9f6` (wip). | Still failing: `runWorkspaceFunction` errors, and the 1st query of every session still returns HTTP 500. Root cause not found. |
| 5 | `genie/fn_genie_handle_message_dev` (1373) | existing, fix | Removed the "FIX 2" fallback query on `genie_user_social_profile.user_id`. | That column does not exist on the table (schema shared across branches, table changed 2026-09-30). Every guest or new-user request failed with `Unsupported parameter reference - xdo.user_id`. Live `v1` does not have this query. | **deployed**, committed `aaac920`. The deployed script was fetched back from Xano and matches the repo file exactly. | Handler now returns `has_results` with 15 venues for `web_guest`. It takes about 13.4s, which was already slow before this change. |
| 4 | `genie/fn_genie_handle_message_v2_dev` (1349) | existing, feature | Added step "4b": when `reply_mode == has_results` and there are venues, call `fn_genie_llm_commentary_dev`. If it succeeds, replace the reply with the commentary. Wrapped in `try_catch`. Kill switch: `$llm_commentary_enabled` (set to `false` to turn it off). New response fields: `pick_reasons`, `llm` (`used`, `fail_reason`, `model`, `latency_ms`). | Connect the LLM to venue, event, neighborhood and ambient results. | **deployed**, committed `f37a6a1`. The deployed script matches the repo file. | Sandbox endpoint, 2nd query of a session: neighborhood request returned 3.0s total, commentary on exactly the 3 shown picks. Venue request returned 16.5s total, also correct picks. The 1st query of a session still fails because of #6. |
| 3 | `genie/fn_genie_llm_commentary_dev` (1550) | **new** | Sends only the top 3 picks (no ownership tags, no paid-placement tier) to `gpt-4o-mini` in JSON mode. Returns `{used, reply, pick_reasons, fail_reason, model, latency_ms}`. Rejects the result if any pick has no reason or the model returns a venue that wasn't given. On failure, the caller keeps its reply-bank text. | The core of the LLM feature. | **deployed**, committed `1e12a32` | `runWorkspaceFunction`: English request 1.8–2.2s; Spanish request answered in Spanish; empty venues gives `no_picks`; 1s timeout gives `used=false`. |
| 2 | `genie/fn_genie_call_ai_dev` (1247) | existing, feature | Optional inputs `model`, `max_tokens`, `timeout`, `json_mode`. Also returns `model` and `latency_ms`. The defaults keep the old behavior (`gpt-4o`, 350 tokens, 30s). | Lets the commentary use a faster model, JSON output and a short timeout. | **deployed**, committed `ffccf78` | Defaults: 200 in 1962 ms. `gpt-4o-mini` + JSON: 200 in 915 ms. |
| 1 | `ep_genie_chat_v2_dev` (API 3139) and 7 functions | snapshot only | Baseline export, no change in Xano. | Git baseline and rollback copy. | committed `3882f2a` | n/a |

### Open issues found during this work (not fixed)
- **The OpenAI API key is written to Xano debug logs.** `genie/fn_genie_detect_language_dev` (1308) logs the whole OpenAI request, including the `Authorization: Bearer sk-proj-…` header (label `LANG_DETECT_FULL_RAW`). Anyone who can see sandbox logs or run history can read the key. **The key should be rotated.** Also, `fn_genie_call_ai_dev` returns the raw request in `error` when a call fails, so that error should not be passed on to clients.
- `ep_genie_chat_v2_dev` (3139) has a broken catch line (`stack: $error.`). Any exception turns into an HTML PHP fatal (HTTP 500) instead of a JSON error.
- `ep_genie_chat_v2_dev` drops `reply_mode`, `pick_reasons` and `llm` from its response. These still need to be passed through, along with `app/api/genie/message/route.ts`.
- Language is detected only on the 1st query of a session. Later turns default to `en`, so a Spanish user's 2nd turn gets English commentary.
- Venue-mode latency: the existing handler takes about 13s on the sandbox before the LLM step. The commentary adds about 1.5–2s.
- Retrieval quality: "cocktail bar for a date" returned Le Jardinier, The Breakfast Klub and Notsuoh. The model comments on whatever it is given.
