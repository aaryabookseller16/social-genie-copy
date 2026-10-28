# User Context

## Summary

Each Genie user has one **user context**: a JSON preference document. Genie reads it at the start of a venue turn and uses it in two places, always below the request itself:

1. **Ranking.** The user's tastes are passed to the request-first search (`fn_genie_search_venues_dev`) as preference keywords, a small bonus that only reorders venues that fit the request about equally. **Not live since 2026-10-23:** Zach's conversation v1 deploy replaced the search, which no longer accepts `preference_keywords` / `avoid_keywords`; the handler still sends them and Xano ignores them. Left as is (2026-10-27 decision); changelog #95.
2. **Picking.** The rendered preferences go into the pick prompt, where they only break ties.

Before sign-in the context belongs to the device. At sign-in it is merged into (or claimed by) the account in `genie_user`. It is filled by quick-pick onboarding, the social-profile intake screen, and venue saves.

This document describes what is built. The design comes from `docs/genie_plan.md` section 5.6 ("plan 5.6") and section 2 of [base_genie_improvements.md](base_genie_improvements.md). The change-by-change record, with Xano IDs and test results, is in [xano/CHANGELOG.md](../../xano/CHANGELOG.md): GEN-010/011/012 (2026-10-12), GEN-013 (2026-10-13, #43–#51) and GEN-013 completion (2026-10-21, #52–#65).

**Status at a glance** (2026-10-21)

| Part | Ticket | Status |
|---|---|---|
| Data model, get/create/update/render functions | GEN-010 | Deployed |
| Migration of social-profile tags | GEN-011 | Run into the `tamu_capstone` datasource on 2026-10-21 (53 created, 12 updated, 550/572 tags; the rest are over the 10-per-category cap). The 2026-10-12 run is still in the live datasource, waiting for the owner. |
| Quick-pick onboarding (web + Xano) | GEN-012 | Deployed |
| Size caps, render budget, resolver | GEN-013 | Deployed |
| Context read in chat + prompt tiebreaker | GEN-013 | Deployed 2026-10-21 (additive on Zach's pick-v2.2 prompt and run_turn v2.1b) |
| Request-first search with preference keywords | GEN-013 | Deployed 2026-10-21 (Zach's `fn_genie_search_venues_dev`, fixed) |
| Guest-to-account linking at sign-in | GEN-013 | Deployed in `merge_guest_profile` |
| Social profile and venue saves write the context | GEN-013 | Deployed (`update_social_profile`, `track_signal`) |
| Legacy social-profile ranking bonus | GEN-013 | Switched off (kill switch in `fn_genie_profile_score_venue_dev`) |

All Xano objects are on the capstone branch `flutter-v2-sandbox-tamu-capstone`. Capstone data lives in the **`tamu_capstone` datasource**: send `X-Data-Source: tamu_capstone` (the web app does this when `XANO_DATA_SOURCE=tamu_capstone`). The `genie_user` table is the account table (section 8; confirmed by the 2026-10-17 database audit, which lists `User` as a legacy table with no references).

---

## 1. Data Model

One `genie_user_context` row per owner:

| Column | Meaning |
|---|---|
| `genie_user_id` | Owner. A table reference to `genie_user` (35), not a plain int. `0` means a device-only (guest) row. |
| `device_id` | Device the row was created from. |
| `context_json` | The document (below). |
| `version` | Bumped on every write. Writes must send `expected_version`; a stale version is rejected. |
| `status` | `active` or `merged`. |
| `updated_at` | Last write. |
| `deleted_at` | Present in the schema; nothing sets it yet. |

`genie_user` is the account table: the auth API group (`auth/me`) authenticates against it. The older `User` table is not used for Genie auth.

A device row that has been merged into an account row is marked `merged` and no longer read.

`context_json` starts as:

```json
{ "schema": 1, "preferences": [], "profile": {}, "onboarding": {} }
```

Each entry in `preferences`:

| Field | Values |
|---|---|
| `id` | `category:value` |
| `category` | Allow-listed: experience, atmosphere, food, music, community, sports_team, event, occasion, neighborhood, price, group_size, typical_time |
| `value` | e.g. `Rooftop`, max 40 characters |
| `source` | `stated` / `inferred` / `connected_account` |
| `confidence` | 0–1 |
| `evidence_count`, `first_seen`, `last_reinforced` | Support and recency |
| `status` | `active` / `user_edited` / `user_removed` / `expired` |
| `sensitivity` | `standard` / `sensitive` (music and community are sensitive) |
| `consent_ref` | Required before a sensitive entry is rendered |

`profile` holds age range and gender. It is never rendered into the prompt. `onboarding` records `{status, at, cards}` from quick-pick onboarding.

### Rules

- **Stated beats inferred.** An inferred add never overrides a stated entry (skipped as `stated_wins`).
- **Removal is a tombstone.** A removed entry stays as `user_removed`. Inference cannot re-add it (`tombstoned`); only a stated add can.
- **Inferred entries are reinforced, not duplicated.** A repeat inferred add bumps `evidence_count`.
- **Sensitive entries are hidden** unless they have a `consent_ref`.

### Caps (GEN-013)

Set as variables at the top of `fn_genie_update_user_context_dev` and `fn_genie_enforce_context_caps_dev`:

| Cap | Value | On breach |
|---|---|---|
| Ops per update call | 40 | Input error `too_many_ops` |
| Category | Allow-list above | Op skipped, `invalid_category` |
| Value length | 40 chars | Op skipped, `value_too_long` |
| Document size | 32 KB | Input error `context_too_large` |
| Live entries per category | 10 | Evict lowest-confidence inferred entry |
| Live entries in total | 60 | Evict lowest-confidence inferred entry |
| Tombstones | 40 | Oldest pruned |

Eviction never removes a stated entry. If the only possible victim is stated, or is the entry just written, the op is skipped with `cap_reached`. Expired entries are dropped first. The size cap was planned as 16 KB and raised to 32 KB because 100 full entries come to about 27 KB.

---

## 2. Xano Objects

| Object | ID | Role |
|---|---|---|
| `fn_genie_get_user_context_dev` | 2062 | Row by `user_id`, falling back to the device row (`genie_user_id = 0`). |
| `fn_genie_create_user_context_dev` | 2059 | Idempotent create at version 1. |
| `fn_genie_update_user_context_dev` | 2061 | Applies `ops[]` (add/remove) and optional `onboarding`, with version check, rules and caps. Returns applied/skipped ops and `evicted`. |
| `fn_genie_enforce_context_caps_dev` | 2123 | Eviction and pruning logic, testable without the database. |
| `fn_genie_render_user_context_dev` | 2096 | Turns the document into prompt text (section 4). |
| `fn_genie_resolve_user_context_dev` | 2125 | Finds the context for a user and/or device; with `link: true` merges or claims a device row (section 3). |
| `fn_genie_apply_context_ops_dev` | 2198 | Writes ops for an account or device: owner lookup, create if missing, chunks of 40. Never throws. |
| `fn_genie_profile_diff_ops_dev` | 2199 | Social profile save → ops, compared with the context's stated entries. |
| `fn_genie_migrate_social_profile_to_context_dev` | 2097 | GEN-011 migration, chunks of 40. `dry_run` defaults to true. |
| `fn_genie_verify_social_profile_migration_dev` | 2098 | Read-only check of the migration. |
| `fn_genie_search_venues_dev` | 2192 | Request-first search (Zach's). Had `preference_keywords` / `avoid_keywords` until his 2026-10-23 rewrite; they are no longer accepted. |
| `fn_genie_build_prompt_dev` | 2091 | Optional `user_context` (section 4). |
| `fn_genie_run_turn_dev` | 2095 | Passes `user_context` to the prompt builder. |
| `fn_genie_handle_message_v2_dev` | 1936 | Reads the context, runs the search, passes both to the model turn (section 3). |
| `fn_genie_profile_score_venue_dev` | 2052 | Legacy social-profile bonus; kill switch off. |
| `GET /genie/ep_get_user_context_dev` | 4527 (Genie_Dev), 4606 (genie_v15) | Read-only. Returns `{found, user_id, version, context, rendered}`. |
| `POST /genie/ep_save_quick_picks_dev` | 4528 (Genie_Dev), 4605 (genie_v15) | Saves onboarding picks as stated adds. Only a verified account owns them; otherwise the device. |
| `POST /genie/ep_genie_chat_v2_dev` | 4200 (Genie_Dev), 4369 (genie_v15) | Optional `device_id`; returns `context` and `search` diagnostics. |
| `POST /genie/merge_guest_profile` | 4108 (Genie_Dev), 4437 (genie_v15) | Links the device's context to the account first, then the existing profile merge. |
| `POST /genie/update_social_profile` | 4106, 4448 | Mirrors the sent fields into the context. |
| `POST /genie/track_signal` | 4107, 4446 | `venue_save` adds inferred food and price preferences. |
| `POST /genie/save_venue` | 4066 (Genie_Dev), 4443 (genie_v15) | A new save by a verified user (`user_id`) adds the same inferred food and price as `track_signal` (`fn_genie_context_from_venue_save_dev`, 2316). Guests, unsaves and repeats write nothing. Returns `context_sync`. |
| `POST /genie/ep_save_social_preferences_dev` | 4324 (Genie_Dev), 4339 (genie_v15) | Auth `genie_user`. Mirrors the sent fields into the account's context like `update_social_profile` (event_categories → event, community_identity → community, music_preferences → music, food_preferences → food, budget_range → price, plus atmosphere, experiences, neighborhood, typical_time, group_size). Avoidances, energy, crowd, age and visit frequency are not mirrored. Returns `context_sync`. |

None of these endpoints has auth, matching the existing Genie guest endpoints, except `ep_save_social_preferences_dev` (signed-in users only). The legacy chat endpoints (`ep_handle_message_dev` 4050/4469, `handle_message` 4343, `external-genie-message-dev` 4171, `OpenAI_ChatCompletions_JSON` 4056) do not read the context; on 2026-10-27 neither app called them and they had no traffic in the capstone request history.

---

## 3. Flows

### Who writes the context

| Writer | When | What |
|---|---|---|
| Quick-pick onboarding (`ep_save_quick_picks_dev`) | First visit, skippable cards | `stated` adds |
| Intake screen (`update_social_profile`) | User saves their preferences | Only the fields sent: new tags → `stated` adds, tags no longer sent → removed (tombstone). `[]` clears a category. |
| Venue saves (`track_signal` `venue_save`, and `save_venue` for verified users) | User saves a venue | The venue's own cuisine tags (up to 3) as `food` and its `price_band` as `price`, `inferred`, confidence 0.4. Repeats raise `evidence_count`. Taps and queries write nothing. |
| Social preferences (`ep_save_social_preferences_dev`) | Signed-in user saves the preferences screen | Same as the intake screen, with the field names mapped (section 2) |
| Sign-in (`merge_guest_profile`) | Right after sign-in (`mergeGuestProfile` in the app) | Device row merged into the account row, or claimed by it (section below) |
| GEN-011 migration | Once | Social-profile tags as `stated` adds |

### Onboarding (GEN-012)

1. `QuickPickOnboarding.tsx` shows the cards from `app/lib/quickPicks.ts` in Genie's greeting. No card uses music or community.
2. The web app posts to `/api/genie/user-context`, which proxies to `ep_save_quick_picks_dev` with `status` `completed` or `skipped`.
3. Xano creates the context if needed, applies the picks as `stated` adds (only when completed), saves `onboarding`, and logs the result.

### Linking at sign-in

`merge_guest_profile` looks up `genie_user` by `external_user_id` and calls the resolver with `link: true`, before its existing social-profile step (which stops with "No guest profile found" when the device has none):
- User row and device row both exist: the device row's live stated entries are merged into the user row; the device row is marked `merged`.
- Only a device row and the user is verified: the user claims the row.
- No rows and the user is verified: an empty context is created.
- `web_guest` never resolves by user.

Chat never links. `genie/convert_guest_session` is not involved (section 8).

### A chat turn (venue mode)

Path: `/api/genie/message` → `ep_genie_chat_v2_dev` → `fn_genie_handle_message_v2_dev` (1936) → the legacy handler (1960) for the shortlist, intent filters and logging, then:

1. **Read the context** (`$context_enabled`). Look up `genie_user` by `external_user_id` (not `web_guest`), call the resolver with `link: false`, render the text, and take the live, non-sensitive atmosphere / experience / food / occasion values as preference keywords. A failure leaves the context empty.
2. **Search** (`$search_enabled`), on `has_results` turns **when no location was sent**: call `fn_genie_search_venues_dev` with the intent filters (meal service, cuisine, keywords from venue type / occasion / vibe), the venue type and "open now" from the message words, and the preference keywords. If it finds matches, its card rows replace the shortlist sent to the model and its `match_quality` goes into the prompt. With a location, the legacy distance-aware list is kept.
3. **Model turn.** `fn_genie_run_turn_dev` gets the venues, `match_quality` and `user_context`; the reply, pick reasons and order come back as before.

The response includes `context` (`{source: user|device|none|error, user_id, count, chars, truncated, keywords}`) and `search` (`{used, match_quality, relaxed, count, …}` or `skipped`).

### Migration (GEN-011)

Social-profile tag arrays and scalar fields map to `stated` adds (experiences → experience, bevy_bites → food, sports → sports_team, price_range/budget_preference → price, and so on). Run into `tamu_capstone` on 2026-10-21. The 2026-10-12 run wrote 58 rows into the live datasource; they stay until the owner approves deleting them (rows created 2026-10-12 16:00–16:02 UTC, ids 9 onward, plus test rows).

---

## 4. How the Model Sees It

`fn_genie_render_user_context_dev` produces:

```
User preferences:
- atmosphere: Rooftop
- experience: Happy Hour, Karaoke (learned)
```

- Only `active` and `user_edited` entries. Sensitive entries only with consent. Profile fields never.
- Stated entries first, then by confidence high to low. Inferred entries are marked `(learned)`.
- Whole category lines are added until the next one would exceed `max_chars` (default 600); `truncated` reports a cut.

`fn_genie_build_prompt_dev` (pick-v2.2) adds the block to the user text with "(Preferences are a tiebreaker only.)" and three rules at the end of section 6, **only when there is a context** (the version then reads `pick-v2.2+prefs`):

- Saved preferences only break ties between candidates that fit equally well; the request always wins. This overrides step 3c ("no saved preferences") for that request.
- A reason may mention a preference the pick clearly matches ("fits your taste for rooftop spots"), never "your profile says", a list of preferences, or one that was not given.
- Preferences never change the reply language or what is said about open status.

Without a context the prompt is byte-identical to Zach's pick-v2.2. In ranking, `fn_genie_search_venues_dev` adds +1 per preference keyword found in the venue's text (at most 2), below one request keyword (+3); preferences never filter or relax. (Not live since 2026-10-23, see section 1.) The render format is provisional until GEN-053.

---

## 5. Web App Files

| File | Role |
|---|---|
| `app/api/genie/user-context/route.ts` | GET proxies to `ep_get_user_context_dev`; POST proxies to `ep_save_quick_picks_dev`. |
| `app/components/single-page/QuickPickOnboarding.tsx` | Onboarding cards. Skippable. |
| `app/lib/quickPicks.ts`, `quickPicks.test.ts` | Card definitions and card → preference mapping. |
| `app/lib/genieClient.ts`, `app/api/genie/message/route.ts` | Send `device_id` with chat messages. |
| `app/lib/server/config.ts`, `xanoProxy.ts`, `xanoCatalog.ts` | `XANO_DATA_SOURCE` → `X-Data-Source` header on every Xano request. |

To run locally against the capstone branch and datasource, set in `.env.local`: `XANO_GENIE_DEV_BASE`, `XANO_AUTH_BASE`, `XANO_STRIPE_BASE` and `XANO_GENIE_VENUES_URL` to the `:flutter-v2-sandbox-tamu-capstone` URLs, `XANO_DATA_SOURCE=tamu_capstone`, and a local `JWT_SECRET`. Without location in the browser, put a city in the message (section 6).

---

## 6. Not Done Yet

**Waiting on someone**
- Owner: approve deleting the 58 `genie_user_context` rows (and test rows) in the **live** datasource.
- Zach: the search now runs inside 1936 (`$search_enabled`). It overlaps his planned tool loop; the kill switch turns it off.
- Rotate the OpenAI key (section 8).

**From the plan, not built**
- Venue-text match terms for learned entries (section 7, known gap).
- Decay and expiry of inferred entries (half-life TBD). Inferred entries are written (venue saves) but never decay.
- Delete on user request and the retention period after account deletion (proposed 3 months).
- Consent flow that sets `consent_ref` for sensitive entries.
- Preference editing UI (plan 5.6.4, optional).
- Confidence-based blend by `strength_tier`, exploration slot, in-chat learning questions.

**Known issues**
- Fixed 2026-10-22: the web app's chat endpoint (Genie_Dev 4200) did not pass `device_id`, so guests' preferences were not read in web chat; and the sign-in merge turned guests' dislikes into likes. `xano/tests/user_context/user_context_e2e.py` checks the whole flow (11/11).
- Fixed 2026-10-27: a web guest's hidden, unverified `genie_user` row (created on their first chat turn) was treated as an account by the resolver (2125) and quick picks (4528), so a guest's preferences were split between that row and the device row. Only verified accounts own a context now.
- The Flutter app does not send `device_id` to chat (4369), so a Flutter guest's saved preferences are not read in chat; signed-in users are fine. The Flutter app also does not call `ep_learn_from_message_dev`.
- The legacy handler (1960) fails when no city and no location are sent; the web route then shows "Here are a few spots with a strong vibe near you." with no cards. Pre-existing.
- `fn_genie_detect_query_mode_dev` sends any message with "tonight" to event mode, which skips the context and the search.
- `update_social_profile` wipes fields that are not sent (pre-existing); the context ignores unsent fields.
- With preferences, the model sometimes still contrasts open status ("though currently closed"), 2 of 11 test runs; `reason_flags` reports it. Same slip as Zach's v2.2 notes without preferences.
- A venue turn takes 8–15 s end to end (two gpt-4o calls plus the search, about 2–3 s).
- Removing an entry that does not exist stores `evidence_count: null` and no `first_seen`. Caps are unaffected.
- `fn_genie_update_user_context_dev` runs the cap check once per op: 40 ops take about 5.7 s.
- XanoScript gotchas found on the way: `|sort:…:false` sorts descending; `|set:k:(x + 1)` and `|get:"k":default` return null; `|set:(expression):v` is invalid; numeric-looking object keys are not found by `|get`; `$input` cannot be passed whole into a function input.

---

## 7. Learning From Chat (GEN-014, built 2026-10-21)

**Decision (2026-10-13, settled 2026-10-21):** Genie updates the user context from what the user says in chat. The model judges whether a message says something lasting about the user's tastes, and whether it is a like or a dislike; there are no keyword lists. Learning is silent and never delays the reply. Dislikes are stored, rank matching venues lower and are never used to hide a venue.

### Flow

1. The web app keeps a short summary of Genie's last reply (text plus up to 5 venues with cuisine, energy, price and vibe; `app/lib/replySummary.ts`) and sends it as `previous_reply` with the next message, so "the first one" or "those" can be resolved.
2. `app/api/genie/message/route.ts` returns the chat reply, then `after()` calls `POST genie/ep_learn_from_message_dev` (`app/lib/server/learnFromMessage.ts`) with the chat's `session_token`. A failure is logged and ignored. Since 2026-10-28 a signed-in user's own session is skipped here and learned by the batch job (below).
3. The endpoint finds the owner (a **verified** `genie_user` by `external_user_id`, else the device), renders the current context, and calls `fn_genie_extract_preferences_dev`.
4. Extraction: one gpt-4o call (JSON mode, temperature 0.2). The model answers `about_user_tastes` first, then for each update gives category, a canonical value (quick-pick vocabulary), `like`/`dislike`, confidence and a word-for-word evidence fragment.
5. The ops go through `fn_genie_apply_context_ops_dev` and `fn_genie_update_user_context_dev`, so the version check and caps apply unchanged.

### Storage

Entries get an optional `sentiment`: `like` (the default; older entries have none) or `dislike`. Same id `category:value`, so "I love happy hour now" flips an earlier dislike (and resets `evidence_count`). Stated beats inferred as before, so an inferred op never flips a stated entry.

### Guardrails (in XanoScript, not trusted to the model)

- Confidence ≥ 0.8 is saved as `stated`, 0.6–0.8 as `inferred` at that confidence, lower is dropped. The cut-offs are variables at the top of the extract function.
- Every word of the evidence must appear in the message or the previous reply.
- Category allow-list; no music or community (sensitive, no consent flow yet); no profile fields; value ≤ 40 characters; at most 5 updates per message.

### How it is used next session

- Render: likes as before; dislikes on one line, `- not into: Happy Hour, Loud & Lit (learned)`, inside the 600-character budget.
- Handler (1936): dislikes are kept out of the preference keywords and sent to the search as `avoid_keywords` (−2 per hit, at most −4, never a filter). Debug: `context.avoid`, `search.avoid_keywords`. The search no longer accepts `avoid_keywords` since 2026-10-23 (section 1); dislikes still reach the prompt ("not into").
- Prompt (2091, 6b block): don't pick a venue whose own fields clearly match a "not into:" item unless asked or nothing else fits; never mention dislikes unless asked.

### Verified

- Extraction eval (`learn_eval.py`, 33 cases, 25 held out): 33/33 on two runs. One-off requests ("tonight I want tacos"), questions and other people's tastes save nothing.
- Local app: "find me a bar for drinks in Houston" saved nothing; "ugh the first one is way too loud for me, i love chill spots with live music though" saved Loud & Lit (dislike), Chill & Intimate and Live Band (likes). The next session's turn had `context.avoid = ["loud & lit"]`.

### Known gap and next step

Saved values are canonical quick-pick words that rarely appear in venue text ("Loud & Lit" vs "energetic … dancing"), so the search bonus and penalty often find no hits and the result rests on the model reading the "not into:" line. In testing, Lost & Found (called too loud) was dropped from the picks on one run and kept first on another. Next: let the extraction also return a few venue-text match terms per entry (for example "energetic", "dancing", "high energy") and match the search on those.

### Batch learning job (2026-10-28)

Signed-in users are now learned from in the background, once per session, instead of with a model call after every message.

- **`genie/ep_learn_job_run_dev`** (Genie_Dev 4607) runs every 10 minutes from `.github/workflows/learn-user-context.yml`. Xano runs scheduled tasks only on its live branch (task history: the events task runs on `v1` every 2 h, never on capstone), so the schedule lives in GitHub Actions. The endpoint sets the datasource itself (`db.set_datasource "tamu_capstone"`), so it never writes elsewhere.
- **Selection:** sessions with a user message from the last 48 h that is newer than `genie_session.meta.learned_through_message_id`, oldest first, at most 25 per run. A run with nothing new is one query (about 100 ms).
- **`genie/fn_genie_learn_from_session_dev`** (2328), per session:
  - **Owner:** the verified `genie_user` with the same `external_user_id` as the session's user row. The chat lifecycle's `identify_user` keys users by channel + `external_user_id`, so sessions point at a per-channel, unverified row even for signed-in users.
  - **Guests are skipped** (a session does not record the device), and the marker is moved past their messages.
  - **Chunks:** new user messages, at most 6 per extraction call (the extractor keeps at most 5 updates), with the Genie reply just before them as `previous_reply`. Earlier messages are never resent, so nothing is reinforced twice.
  - **Writes** go through `fn_genie_apply_context_ops_dev`, unchanged.
  - **Marker:** moves only after a chunk succeeds, so a failed model call is retried by the next run.
  - **Overlapping runs:** a claim in `meta` (write, wait 1 s, re-read) means two runs never learn the same messages.
- **Per message, still:** `ep_learn_from_message_dev` now gets the chat's `session_token` (the route passes the one from the chat reply). It skips (`skipped: "batch_job"`) only when the sender is a verified user whose own session it is. Guests, and users who sign in during a guest-owned session, are still learned right away. `$batch_job_on` in that endpoint must match `$job_enabled` in the job (kill switch). **It is false for now**: nothing calls the job until the workflow is pushed, so every message is still learned per message. To switch over, push the workflow, then set it to true in 4566 and 4567.
- **Delay:** within the same conversation, nothing changes (the chat history carries it). A brand-new conversation started within about 10 minutes sees the older saved preferences.
- **Tests:** `xano/tests/learning/learn_job_tests.py`, 44/44 (results in `xano/tests/learning/RESULTS.md`), using throwaway `test-learn-` users made by `genie/ep_test_fixture_dev` (4608, capstone and `tamu_capstone` only).
- **Follow-up (not changed):** `ep_get_user_context_dev`, `ep_save_quick_picks_dev`, `merge_guest_profile` and the context read in 1936 look up `genie_user` by `external_user_id` without filtering on `verified` in the query. With per-channel rows they rely on the account row being returned first (the oldest). `fn_genie_apply_context_ops_dev` and `ep_learn_from_message_dev` now filter on `verified == true`; the others should get the same one-line change (1936 is Zach's).

---

## 8. Verified Against Live Xano (2026-10-13, updated 2026-10-21)

Checked on `flutter-v2-sandbox-tamu-capstone` through the Xano MCP. Earlier sections were written from repo snapshots and the changelog. This section records where live Xano differs.

| Question | Live answer |
|---|---|
| Main user table | `genie_user` (35). `GET /auth/me` in the auth group (`dRDS80y8`, group 119) has `auth = "genie_user"` and reads `genie_user`, which has its own `membership_plan`. `User` is not involved. |
| What `genie/convert_guest_session` does | Both copies (Genie_Dev 4078, genie_v15 4358) are identical: set `genie_session.user = user_id`, move unassigned `genie_saved_venues` to the user, return a count. They do **not** set `genie_user.verified`, link to `User`, or touch `genie_user_context`. No auth, and `user_id` comes from the request body. The `precondition ($session == null)` looks inverted: it would reject any session that exists. Neither endpoint has request history. |
| `genie_user_context.genie_user_id` | A real table reference to `genie_user` (`tableref_id: 35`), int, default 0. |
| LLM calls per chat turn | See below. |
| OpenAI key in debug logs | Confirmed and fixed (see below). |

### LLM calls on a live chat turn

Path: `ep_genie_chat_v2_dev` (4369) → `fn_genie_handle_message_v2_dev` (1936) → `fn_genie_handle_message_dev` (1960) for venue and event modes.

| Call | Model | When it runs |
|---|---|---|
| `fn_genie_detect_query_mode_dev` (1919) | none | Every turn. Keyword rules only. |
| `fn_genie_parse_intent_dev` (1836) via `fn_genie_call_ai_dev` | gpt-4o | Every venue/event turn in a supported city, **unless** its keyword rules find a type, cuisine, venue type, occasion or vibe. The rules never set `energy` or `music`, so most messages ("drinks tonight in Midtown") trigger the call. |
| `fn_genie_run_turn_dev` (2095) | gpt-4o, JSON mode | Venue mode, `has_results`, at least one venue. |
| AI fallback in 1960 (`fn_genie_call_ai_dev`) | gpt-4o | Only when the city is not supported (`force_ai`). |
| `fn_genie_detect_language_dev` (1895) | gpt-4o | **Not on the v2 path.** 1936 passes `detected_language: "en"` to 1960, which skips detection when a language is given. Translation therefore never runs on v2 either. |
| Neighborhood and ambient modes | none | Reply bank text only. |

So a typical venue turn makes two gpt-4o calls (intent parse and picks), and a turn with no results makes one. The live 1936 (updated 19:40 and 19:56 UTC) is the #30 version with model picks; the 2026-10-08 LLM-commentary version is gone.

### Overwrite of #38/#39 (resolved)

On 2026-10-13 at 19:56 UTC, Zach's language-detection change re-saved 2091, 2095 and 1936 from versions without `user_context`. On 2026-10-21 the tiebreaker was re-applied on top of his newer versions (#55, #56), adding lines only.

### OpenAI key in debug logs

`fn_genie_detect_language_dev` (1895, this branch; 1308 in the changelog is another branch's ID) logged the whole `api.request` result as `LANG_DETECT_FULL_RAW`, including the `Authorization: Bearer` header. On 2026-10-13 that log was removed on the capstone branch; the status/result log remains. A test run ("¿Dónde hay un buen bar de tacos?" → `spanish`) logged no headers.

Still open:
- **Rotate the key.** Old run history still contains it, and `OPENAI_API_KEY` is a workspace env var, so the same key may be used by live `v1`.
- The same function on other branches (`v1`, `flutter-v2-sandbox`) was not checked or changed.
- `fn_genie_call_ai_dev` (1834) returns the whole `api.request` result in `error` when the status is not 200, which includes the request headers. Callers must not log or return that field.
