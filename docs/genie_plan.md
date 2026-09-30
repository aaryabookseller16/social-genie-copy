# Predictive Genie: Architecture and Implementation Plan

**Project:** Social Bevy capstone (CSCE 482), WS-9 Predictive Intelligence
**Status:** Draft v0.2, September 29, 2026 (restructured into two tracks)
**Owner:** Technical architecture (Saketh Mugunda, backup Zach Pyun). Final decision: the team. Items marked *sponsor approval* need Mr. Roundtree's sign-off.
**Feeds final report sections:** Design, Annex 5 (Prototype), Annex 6 (Design Models)

---

## 1. Purpose and scope

This plan covers two related pieces of work on Genie, built in this order:

| | Track 1: Chat improvements (**build first**) | Track 2: Proactive notifications (**build second**) |
|---|---|---|
| **Goal** | Make Genie itself better (context, preferences, prompts, follow-up handling, response quality) and improve the chat page UX | Forecast neighborhood demand and send a well-timed, opt-in notification with 3 ranked picks before the user searches |
| **Today** | Reactive: user asks, Genie returns 3 picks plus about 12 more nearby | No proactive behavior exists |
| **Main new parts** | Preferences model and onboarding, conversation state, intent handling, system prompt rewrite, chat UX, booking handoffs, richer logging | Forecast service, aggregation, trigger and gates, notification and picks screen |

**Why this order.** Track 2 sends picks chosen by Genie's engine using each user's preferences. An alert is only as good as those recommendations. Track 1 also produces the preference data and the behavioral logging that Track 2's aggregation and personalization depend on.

**Shared foundation** (section 7): the preferences model, behavioral logging, consent, and privacy rules serve both tracks.

**Out of scope for this file:**
- Level 2 real-time location triggers (WBS 8.0, deferred)
- Level 3 habit patterns over 21 days (WBS 5.0); the data model leaves room but is not designed here
- Live city activity monitor (WBS 7.0), vendor features, payments
- Sprint 0 documentation (tracked separately)

> **Scope note.** The sponsor's requirements document assigns our team the forecast, the proactive trigger, and documentation (Part 6.2-6.4). Track 1 goes beyond that. Our own team agreement says to contact the sponsor before adding features, and Genie's engine and its multi-agent redesign are owned on the sponsor's side. Track 1 needs *sponsor approval* and coordination before work starts (open questions 1 and 2).

### Status labels used throughout

| Label | Meaning |
|---|---|
| **EXISTING** | Already in the Social Bevy build (Xano backend or the Next.js app) |
| **NEW** | Built by our team |
| **CONNECT** | Exists in some form; we wire it in and verify |
| **DECISION** | Decided by the team on 9/29 |
| **TBD** | Open; needs a team or sponsor answer (section 11) |
| **ASSUMPTION** | Believed true from the code analysis but not verified against Xano |

---

## 2. Decisions recorded so far

| # | Decision | Notes |
|---|---|---|
| D1 | Each preference is stored as its own record with source, confidence, and status | 5.6.2 |
| D2 | All five cold-start techniques are planned | 5.6.1 |
| D3 | Preference-editing UI ideas are **optional** and listed for team review before implementation | 5.6.4 |
| D4 | Age is collected as a **range**. Gender is optional and never used for ranking. Race is **not collected**. | Community and music tags stay opt-in and off by default (proposed) |
| D5 | **Exact coordinates are used for now.** The requirements document (NF-009) will be updated. | *Sponsor approval* (his document). See section 7.4. |
| D6 | The plan covers both tracks: chat improvements first, then proactive notifications | Section 1 |

---

## 3. System at a glance

```
TRACK 1: CHAT IMPROVEMENTS (first)

 User ─▶ Chat page ─▶ /api/genie/message ─▶ Xano Genie
                                                 │ 1. assemble context (preferences, conversation state,
   Inputs:                                       │    location → neighborhood)
   • preferences (stated + inferred)             │ 2. classify intent (new request / follow-up / direct)
   • City Graph + venue/event catalog            │ 3. call tools (search, lookup; forecast later)
   • system prompt + tool descriptions           │ 4. rank and phrase
                                                 ▼
                      Reply (picks / follow-up answer / direct answer)
                                   │                       │
                        booking & maps links        logging ─▶ preference updates
                                                             └▶ (feeds Track 2 aggregation)

TRACK 2: PROACTIVE NOTIFICATIONS (second)

 Behavioral events ─▶ aggregation ─▶ demand_observation ─┐
 Weather / events / sports ─▶ context_feature ───────────┴▶ model ─▶ batch forecast (every 4 h)
                                                                          │
                                                                  Forecast REST API
                                                                          │
   Xano trigger (gates: threshold, consent, cap) ─▶ rank 3 picks (Track 1 engine)
        ─▶ push (OneSignal) ─▶ deep link ─▶ picks screen ─▶ Genie chat session (follow-ups)
```

**Design principles (both tracks)**
1. **Relevance first.** Commercial multipliers never override relevance, and ads never appear in Genie.
2. **Learn through conversation, not forms.** Any onboarding stays short and skippable.
3. **Users control their profile.** What Genie learns about you is visible and correctable.
4. **Send nothing when unsure** (Track 2). Stale forecast, no consent, cap reached, or too few valid picks all mean no notification.
5. **The forecast service never sees a user** (Track 2). It receives a neighborhood, category, and time window and returns a score.
6. **Build on Xano.** Xano remains the system of record and owner of ranking, sessions, and push. Track 2's forecast service is a separate service Xano calls.

---

## 4. Inputs and outputs (both tracks)

Direction key: **IN** = consumed by the system, **OUT** = produced, **BOTH** = read and also updated. Track key: **1**, **2**, or **1+2**.

### 4.1 Inputs

| Input | Dir. | Track | Source | Status | Privacy class | Used for |
|---|---|---|---|---|---|---|
| **User message** (typed or transcribed voice) and conversation history | IN | 1+2 | App → `/api/genie/message` | EXISTING | Behavioral (free text may contain PII) | Intent, retrieval, replies |
| **Conversation state** (active topic, last shown items, applied filters) | BOTH | 1 | Session | NEW | Behavioral | Follow-up handling (5.3) |
| **Age range** (bands, see 5.6.3) | IN | 1 | Onboarding / settings | NEW | PII | Eligibility (21+ venues). Never a forecast feature. |
| **Gender** (optional) | IN | 1 | Onboarding / settings | NEW | PII, sensitive | The user's own profile only. **Never used for ranking or models.** |
| **Race / ethnicity** | none | none | **Not collected** | DECISION | n/a | n/a |
| **Location** (exact coordinates, for now) | IN | 1+2 | Device geolocation | EXISTING | PII, sensitive (precise geolocation) | Resolve neighborhood and distance at request time. Never enters the forecast pipeline. |
| **Preferences** (stated and inferred) | BOTH | 1+2 | Quick-pick onboarding, in-chat learning, behavior, user edits | NEW model over EXISTING social profile | Behavioral; community and music tags treated as sensitive | Ranking, cold start, notification targeting |
| **Consent and notification settings** | BOTH | 2 (consent model shared) | Consent moment, Settings | NEW | PII-linked | Gates |
| **Push token** | IN | 2 | OneSignal via `register-push-token` | EXISTING | PII | Delivery |
| **Behavioral events** (queries, taps, saves, check-ins, opens) | IN | 1+2 | Existing signal routes | EXISTING (new event types NEW) | Behavioral | Preference learning, aggregation |
| **Venue and event catalog / City Graph** | IN | 1+2 | Xano catalog and City Graph (WS-5) | EXISTING / CONNECT | Public | Candidate picks, neighborhood mapping. **GEN-007 sandbox finding:** `genie_venues.neighborhood_id` is an integer without a declared Xano table reference; text neighborhood fields also exist. Application-level mapping is not verified. See [Xano table reference](architecture/xano_tables.md#observations). |
| **System prompts** (response structure, good and bad examples, thinking steps) | IN | 1 (+2 additions) | Xano AI orchestration | EXISTING prompt, NEW rewrite | n/a | Reply quality (5.4) |
| **Tool and skill descriptions** (API access, what the City Graph is and how to use it) | IN | 1 (+2 forecast tool) | System prompt | EXISTING, NEW additions | n/a | Tool use (5.5) |
| **Weather forecast** | IN | 2 | OpenWeatherMap (INT-010, live) | EXISTING source, NEW ingestion | Public | Forecast feature |
| **Event rank scores** | IN | 2 | PredictHQ (INT-009, live) | EXISTING source, NEW ingestion | Public | Forecast feature |
| **Sports schedule** | IN | 2 | Source TBD | TBD | Public | Forecast feature |
| **Day type** (holiday, weekend, school break) | IN | 2 | Calendar library | NEW | Public | Forecast feature |
| **Future: external busyness and event APIs** | IN | Later | To be added once the system works and we want improvements | Future | Public / licensed | Extra features for chat and forecast. *Check licensing and storage terms first.* |

### 4.2 Outputs

| Output | Dir. | Track | Consumer | Status | Notes |
|---|---|---|---|---|---|
| **General response**: 3 picks plus about 12 more nearby | OUT | 1 | User | EXISTING, improved | New activity requests |
| **Follow-up response** (refines or answers about the previous answer) | OUT | 1 | User | NEW behavior | Uses conversation state (5.3) |
| **Direct reply** to a specific question | OUT | 1 | User | NEW behavior | No new recommendation list |
| **Booking and maps handoff** (rides, tickets, reservations, directions) | OUT | 1+2 | User → partner site | CONNECT | 5.8 |
| **User data logging** back to the database (how users use Genie; feeds preference learning) | OUT | 1+2 | Xano database | EXISTING routes, NEW event types | 5.9 |
| **Preference updates** (inferred adds, decay, user edits and removals) | OUT | 1 | Xano database | NEW | 5.6.2 |
| **Forecast** (0-100 score per neighborhood × category × window, plus freshness flags) | OUT | 2 | Xano (trigger, later chat tool) | NEW | REST API, no user data |
| **Proactive push notification** | OUT | 2 | User | NEW content, EXISTING OneSignal | Opt-in only, deep link |
| **Picks screen** with reasons and "Why am I seeing this?" | OUT | 2 | User | NEW screen | Opens a Genie session |
| **Delivery and quality summary** (aggregate only) | OUT | 2 | Team, sponsor | NEW | No user identities |
| **Team alerts** (failed run, stale forecast, cap anomalies) | OUT | 2 | Team | NEW | |

---

## 5. Track 1: Chat improvements

### 5.1 Goals (proposed, confirm with the team)

1. Recommendations that reflect the user's tastes from the first session (cold start).
2. Genie reliably tells apart a **new request**, a **follow-up**, and a **direct question**, and responds appropriately to each.
3. Every pick has a short, honest reason grounded in data Genie actually has.
4. Users can see and correct what Genie thinks they like.
5. A chat page that makes these behaviors clear and easy to use (small front-end changes, open for discussion and scheduled later, see 5.7).
6. Clean logging that improves preferences and shows how people use Genie.

### 5.2 Request workflow (target design)

1. **Capture.** The user types or speaks a message (existing voice-confirm behavior stays). A named city still beats device coordinates.
2. **Assemble context.** Xano builds a compact context: the user's active preferences (never removed ones; sensitive ones only if opted in), age-range eligibility, conversation state, and resolved neighborhood from location.
3. **Classify intent:** new request, follow-up, or direct question (5.3).
4. **Plan and call tools:** City Graph and catalog search, venue and event lookup, and (once Track 2 exists) the forecast tool for time-relative questions (5.5).
5. **Rank.** Relevance from preferences and behavior, then candidates from the catalog (blend in 5.6.1).
6. **Phrase.** Reply follows the response structure in the system prompt, with a one-line reason per pick.
7. **Present.** The chat page shows picks with action buttons (5.7, 5.8).
8. **Log.** Events feed preferences and aggregation (5.9).

### 5.3 Conversation state and intent handling

**Conversation state** is a small structured object kept per session, not just message history:
- `active_topic`: category, place or neighborhood, time window, filters (price, distance, vibe)
- `last_shown`: ordered IDs of the items in the last reply
- `origin`: `chat` or `proactive` (Track 2)

**Three cases Genie must separate:**

| Case | Example | Behavior |
|---|---|---|
| **New request** | "Actually, somewhere for live music Saturday" | Replace the active topic, fresh search and ranking, new picks |
| **Follow-up on the previous answer** | "What about the second one?" / "Anything cheaper?" / "Is it busy?" | Resolve references ("second one," "that place") against `last_shown`, keep the active topic, refine filters or answer about the items |
| **Direct question** | "What time does it close?" | Answer directly from the data, no new recommendation list |

**Ambiguity rule (proposal):** if a message could be a follow-up or a new request, choose the more likely one and make the assumption visible ("Sticking with rooftop bars in Midtown. Say the word if you want something different."), or ask at most one short clarifying question.

**GEN-008 sandbox finding:** Xano returns `query_mode` and `reply_mode`; the Next.js route derives its own `response_mode`. The endpoint request has no explicit `active_topic`, `last_shown`, or `origin` fields. See the [chat orchestration audit](architecture/genie_chat_orchestration.md#mode-fields).

### 5.4 System prompt design

The system prompt is an **input** and is one of the main Track 1 deliverables. It lives in Xano. Proposed sections:

1. **Role and principles:** relevance first, no ads, honest about boosts, learn through conversation, never mention or infer sensitive traits.
2. **Response structure:** 3 picks with a one-line reason each, then about 12 more nearby. Follow-ups are short. Direct questions get direct answers. No invented venues: only items returned by tools.
3. **Thinking steps:** (a) classify the message; (b) resolve place and time; (c) read active preferences and conversation state; (d) call tools; (e) rank; (f) phrase; (g) check the reply against the rules.
4. **Tools and skills:** what each tool is, when to use it, what it returns, and what to do on failure (5.5).
5. **Good and bad examples** for each case in 5.3, and for reason lines.
6. **Guardrails:** never expose other users' data, never present uncertain data as certain, never use gender or sensitive tags for ranking, say plainly when nothing matches.

Example, reason-line phrasing:
- **Good:** "Fits your taste for rooftop spots, and it's a 6-minute walk from where you are."
- **Bad:** "Because your profile says you are X."

*Sample forecast phrasing (Track 2 and later chat use):*
- **Good:** "Midtown is expected to be busier than usual tonight, so I'd book ahead."
- **Bad:** "Midtown demand score is 87, so it will be packed."

### 5.5 Tools and skills

| Tool | Purpose | Status |
|---|---|---|
| City Graph and catalog search | Find venues and events by category, place, vibe. For now, the City Graph is the structured map of Houston's venues, events, and neighborhoods. *Confirm what it exposes.* | EXISTING / CONNECT |
| Venue and event lookup | Details: hours, address, links | EXISTING |
| Preference read | Compact active-preference summary (read-only; the model cannot edit) | NEW |
| Booking and maps link builder | Action links per pick | CONNECT (5.8) |
| Forecast lookup | Expected busyness for a neighborhood and window | NEW in Track 2, optional later in chat |
| External busyness and event APIs | More data sources | Future |

### 5.6 Preferences and cold start

#### 5.6.1 Cold start (D2: all five, layered)

1. **Quick-pick onboarding.** 6-8 tappable cards ("Which of these sounds like a good night?"), skippable, about 30 seconds, shown at signup to create a baseline for every user. Builds on the existing profile intake fields (experiences, atmosphere, food, price, group size, typical time). Saved as `source = stated`.
2. **In-chat learning.** To honor "Genie learns through conversation, not forms," Genie also asks one light question in early sessions (proposed: at most one per session for the first 3 sessions), and the quick-picks appear as part of Genie's greeting rather than a separate form.
3. **Popularity fallback.** With no history, rank by what is popular in the user's neighborhood at that time, using catalog popularity (and the forecast once Track 2 exists).
4. **Confidence-based blend** by `strength_tier`. Weights are **proposals except the `strong` row, which is existing behavior.**

| Tier | Stated preferences | Learned behavior | Popularity |
|---|---|---|---|
| new | 60% | 0% | 40% |
| getting_started | 45% | 25% | 30% |
| learning | 35% | 45% | 20% |
| strong (existing: 10+ signals) | 30% | 70% | 0% |

   If a user skips onboarding, the stated share shifts to popularity. Changing this blend requires Xano access and sponsor awareness, since it alters Genie's ranking.

5. **Exploration slot.** For `new` and `getting_started` users, one of the 3 picks is a deliberate "something different." It must still fit the time and place so relevance stays first. Taps and skips on it teach Genie faster.

#### 5.6.2 Preference data model (D1)

Every preference is its own record (`user_preference`):

| Field | Purpose |
|---|---|
| `preference_id`, `user_id` | Identity |
| `category` | experience, atmosphere, food, music, community, sports_team, price, group_size, typical_time, etc. |
| `value` | e.g., "Astros," "rooftop," "R&B / Soul" |
| `source` | `stated` / `inferred` / `connected_account` |
| `confidence` | 0-1 |
| `evidence_count`, `first_seen`, `last_reinforced` | Support and recency |
| `status` | `active` / `user_edited` / `user_removed` / `expired` |
| `sensitivity` | `standard` / `sensitive` |
| `consent_ref` | Consent version covering it (required for sensitive) |

**Rules**
- **Stated beats inferred.** Inference never overrides a stated preference.
- **Removal is a tombstone.** If a user removes "Astros," the record stays as `user_removed` and inference never re-adds it unless the user does.
- **Inferred preferences decay** if not reinforced (half-life TBD) and expire below a confidence floor.
- **Inference needs evidence:** a minimum number of consistent signals in a time window (placeholder: 3 in 30 days).
- **Sensitive preferences** (community and music tags) are excluded from ranking, targeting, and aggregates unless the user opted in. Off by default.
- **Evidence is kept as references and counts** so a "Why?" view can explain an inference without exposing raw queries.
- **Migration:** existing social-profile tag arrays convert to `source = stated` records.

#### 5.6.3 Personal data collected (D4)

| Field | Collected as | Use |
|---|---|---|
| Age | Range: 21-24, 25-29, 30-34, 35-39, 40-45, prefer not to say | Eligibility for 21+ venues. Not a forecast feature. |
| Gender | Optional, self-described or skipped | Profile only. Never used for ranking, targeting, or models. |
| Race / ethnicity | Not collected | n/a |
| Location | Exact coordinates for now (D5) | Resolve neighborhood and distance at request time |

The sponsor's audience is adults 21-45 (a "45+" band may be needed, TBD).

#### 5.6.4 Preference editing UI (OPTIONAL, for team review before implementation)

Nothing here is committed. Candidate ideas to discuss:

- **"What Genie thinks you like" screen:** chips grouped by category, badged "You told us" or "Learned from your activity." Each has a remove control and a "Why?" showing evidence (for example "You saved 3 sports bars").
- **Inline confirmations in chat:** "Looks like you're into the Astros. Right?" with **Yes** and **Not me** buttons.
- **Correct by chat:** "I don't actually like sports" is parsed into a preference update.
- **Pause or reset learning:** stop learning, or clear everything Genie inferred.
- **Sensitive interests toggle:** an explicit, separately explained opt-in for community and music tags.

### 5.7 Chat page UX (OPEN FOR DISCUSSION, deferred)

**Status: open for discussion and intentionally postponed.** These are expected to be small, mostly front-end changes that do not change Genie's logic much, so they do not block the logic work in 5.2-5.6 and can be scheduled later. The specific changes are not yet decided. The list below is a starting proposal only; nothing is committed, and the team will replace or extend it when this work is picked up.

The only UI that Track 1 logic depends on is the minimum needed to collect and correct preferences (quick-pick onboarding in 5.6.1 and, if approved, the editing options in 5.6.4). Everything else below can wait.

| Candidate | Supports goal |
|---|---|
| **Pick cards** with a photo, one-line reason, and action buttons (directions, book, save) | 3, booking |
| **Follow-up suggestion chips** under each reply ("Cheaper," "Closer," "Later tonight") | 2 |
| **Context indicator** showing what Genie is currently helping with ("Rooftop bars near Midtown, tonight") with a one-tap "start over" | 2 |
| **"Why this pick?"** expandable reason per card | 3 |
| **Thumbs up/down or "not for me"** on a pick (logged as a rejection signal, D-004) | 6 |
| **Onboarding quick-picks** as part of the first-run greeting, skippable | 1 |
| **Clear empty, error, and slow states** (no results, fallback reply, loading) | 5 |
| **Accessibility:** screen-reader labels, focus order, contrast, touch targets (WCAG 2.2 AA) | 5 |

**Implementation note:** the consumer app is one component of about 5,400 lines. New UI (pick cards, onboarding, settings) should be built as **separate components** in their own files, not added to the large file. The repo already has empty `components/account/` and `components/vendor/` folders from an intended split.

### 5.8 Booking and maps handoff (CONNECT)

**GEN-008 sandbox finding:** Existing outbound handoffs include venue reservations, event ticket URLs, Uber links, and Google Maps directions. The web app consumes Xano URLs and also constructs some Maps/Uber URLs from venue data; no native booking or partner API integration was identified. See the [chat orchestration audit](architecture/genie_chat_orchestration.md#booking-ticket-ride-and-directions-links). Reconcile the `reservation_url` and `opentable_url` fields before extending reservation behavior.

### 5.9 Logging and feedback

Every meaningful action is logged and used two ways: (1) update **inferred preferences** (with decay and user-removal rules), and (2) become anonymous demand counts in Track 2's aggregation.

New event types (added to the existing signal routes):
`intent_classified` (new / follow-up / direct), `pick_shown`, `pick_tapped`, `pick_saved`, `pick_rejected`, `follow_up_chip_tapped`, `booking_click`, `why_viewed`, `onboarding_completed` / `skipped`, `pref_confirmed`, `pref_edited`, `pref_removed`, plus the Track 2 events in 6.6.

Logging stays fire-and-forget (never fails a user action). Raw query text is already stored as a behavioral signal; Track 1 should decide whether to keep raw text, derive intent and category fields instead, or limit its retention (TBD).

### 5.10 Track 1 risks

| Risk | Mitigation |
|---|---|
| **Latency.** Sponsor target is under 2 s end to end (NF-001); intent classification plus tool calls plus richer prompts add time. | Keep the context compact; classify intent cheaply; measure early; cache preference summaries |
| **Overlap with the sponsor's multi-agent redesign** owned by his team | Coordinate before touching the prompt or orchestration (open question 2) |
| **Sandbox and Xano access** may not be available yet | Confirm access; otherwise Track 1 is design-only |
| **Ranking changes affect real users** | Sandbox only; sponsor reviews before production |
| **Over-asking in chat feels like a form** | Question budget, skippable, measure drop-off |

---

## 6. Track 2: Proactive notifications

### 6.1 Overview and dependency on Track 1

Track 2 has two halves: a **forecast service** that says where and when demand will be high, and a **trigger and notification flow** that turns that into an opt-in alert. The alert's 3 picks come from the Track 1 engine and preference model. Tapping the alert opens a Genie chat session, so follow-ups use Track 1's conversation handling.

### 6.2 Forecast service (NEW)

**Components**

| Component | Job |
|---|---|
| **Aggregation job** | Reads Layer 1, drops IDs, maps coordinates to `neighborhood_id`, counts, suppresses small cells, writes `demand_observation` |
| **Context ingestor** | Fetches weather, event ranks, sports, day type for the next 72 hours into `context_feature`. Pluggable for later data sources. |
| **Training and evaluation pipeline** | Offline. Trains candidates, compares to baseline on held-out data, registers passing models |
| **Model registry** | Versioned models plus evaluation reports |
| **Batch scorer and validator** | Every 4 hours: scores all combinations (neighborhood × 4 categories × 18 windows), validates, promotes the run to active |
| **Forecast store** | Holds runs and an active-run pointer |
| **Forecast REST API** | Serves the active run |
| **Freshness and latency monitor** | Alerts on stale, failed, or slow runs |

**Where aggregation runs (recommendation):** inside Xano as a scheduled task, so Layer 1 never leaves Xano and our pipeline pulls only Layer 2 rows. This also fits Xano's 25-row batch limit (NF-004). *Open: who owns D-001/D-002 raw capture (us or WS-5)?*

**Modeling approach**
1. **Baseline first:** seasonal-naive (same neighborhood, category, and time of week, averaged over recent weeks).
2. **Then one global gradient-boosted model** (XGBoost or LightGBM, team's choice) using neighborhood, category, hour, day of week, day type, weather, event rank, sports flag, and lagged demand.
3. **Ship the model only if it beats the baseline** on held-out data; otherwise ship the baseline.

**Data reality:** real behavioral data will not exist until about Q2 2027 (sponsor doc 6.5). Until then, train and validate on **synthetic and public proxy data** (candidates to evaluate: public trip or foot-traffic datasets, Houston open data). Every row carries `source = real | proxy | synthetic`, and accuracy claims must state which data they were measured on. Track 1 logging starts producing real data as soon as it ships, which is another reason it comes first.

**Run lifecycle**

```
Scheduled → Ingesting context → Scoring → Validating → Active (served)
                                                          │
                                       age > threshold [TBD] ▼
                                                   Active but Stale (served with stale=true)
                                                          │
                                                          ▼
                                                     Superseded
Failed runs are never served and alert the team.
```

- **Weather unavailable:** reuse the last forecast with `degraded_inputs = true`. Whether alerts may be sent from a degraded run is TBD.
- **Stale forecast:** the trigger sends nothing.

**API contract (draft).** Called by Xano over HTTPS with an API key in an environment variable (NF-012). No user data in requests.

```
GET /v1/forecast?neighborhood_id=..&category=..&from=..&to=..
GET /v1/forecast/top?window_start=..&category=..&limit=..    // busiest neighborhoods
GET /v1/health                                               // run age, status

Response (example):
{
  "run_id": "2026-10-03T12:00Z",
  "model_version": "v0.1-baseline",
  "generated_at": "...",
  "stale": false,
  "degraded_inputs": false,
  "windows": [
    { "start": "...", "end": "...", "neighborhood_id": "...", "category": "restaurants", "score": 78 }
  ]
}
```

Target p95 under 500 ms (NF-002). Responses are reads from a pre-computed store, so this should hold comfortably.

**Hosting (TBD, needs sponsor budget approval).** Constraints: cloud-deployable, no on-premise servers, keys in environment variables, sandbox first. Options: (a) a small serverless container running the scorer on a schedule with a managed database for the store, or (b) a scheduled job writing results to object storage with a thin serverless read function. Option (b) is likely cheapest; decide once costs are estimated.

### 6.3 Trigger and gates (NEW in Xano)

Runs after each active forecast. For each candidate (neighborhood, category, window) and each possible user, in this order:

| Gate | Rule | Status |
|---|---|---|
| 1. Forecast fresh and not failed | Otherwise send nothing and alert the team | Proposed (AC-1) |
| 2. Demand threshold | Score at or above threshold. **Placeholder: 70.** Tune on proxy data. | TBD |
| 3. Consent | Active `proactive_consent` and a registered push token | AC-1, NF-011 |
| 4. Relevance to user | Category not muted, neighborhood matches the user (targeting below) | NEW |
| 5. Cap and quiet hours | Shares the sponsor's cap of **3 per week in the first 30 days** (N-009) with existing prompts (N-005/006/007). Quiet hours respected. | TBD: confirm proactive alerts share N-009 |
| 6. Dedup | At most one alert per user per window | NEW |
| 7. Enough good picks | At least 3 open, relevant venues or events in that window, else send nothing | Proposed |

**Targeting in v1 (proposal):** live location triggers are deferred, so target users by their **home city plus neighborhoods they frequently search or visit**, matched against category preferences. No live tracking.

**Lead time:** send 2-4 hours before the window opens (proposed; TBD). **Processing:** Xano pages users in batches of 25 (NF-004).

### 6.4 Notification content and screens

- **Text:** built from templates using neighborhood, window, and category, for example "Montrose is filling up tonight, 8 pm to midnight. 3 spots near you match what you like." Templates keep messages predictable, testable, and cheap. No LLM at send time. *(Proposal.)*
- **Naming the neighborhood on the lock screen:** TBD (privacy versus usefulness).
- **Deep link (N-010):** opens the picks screen directly using the app's existing `?screen=` routing, for example `/?screen=picks&alert=<alert_id>`. The `alert_id` is opaque and never a user identifier.
- **Picks screen:** 3 picks, each with a reason and the same action buttons as Track 1 pick cards. If a pick has closed, show the next one (AC-2).
- **"Why am I seeing this?":** rendered from structured reason codes (`forecast_busy`, `pref_match:<id>`, `near_frequent_area`, `event_tonight`, `boosted` if a commercial factor applied). Must be honest about boosts.
- **Dismiss and turn off:** dismiss one alert, or turn off proactive alerts, in at most 2 taps with confirmation and screen-reader labels (AC-3).
- **Never in an alert:** ads.
- **Score copy:** users never see the raw number. Bands (placeholder cutoffs): 0-39 "quieter than usual," 40-69 "typical," 70-100 "filling up."

### 6.5 Picking the 3 and handing off to chat

**Candidate set:** venues and events in the target neighborhood, open during the window, in the alert's category. The forecast selects *where and when*; the Track 1 engine and the user's preferences select *what*. It reuses Genie's existing ranking (alignment rule and relevance-first principle intact). *Sponsor decision: do tier and Boost multipliers apply to proactive picks? Ads never do.*

Opening the picks screen starts (or attaches to) a Genie session with `origin = proactive` and the 3 picks and reason codes in the conversation state. Follow-ups then behave exactly like Track 1 follow-ups.

### 6.6 Track 2 logging

`proactive_sent`, `proactive_opened` (with time-to-open, via the existing `notification-opened` route), `proactive_dismissed`, `proactive_off`, `proactive_expired`.

---

## 7. Shared data design and privacy

### 7.1 Privacy classes and boundaries

The sponsor's three classes apply at capture (D-002): **PII**, **Behavioral**, **Aggregate**.

| Layer | Where | Contains | Who may read |
|---|---|---|---|
| Layer 1 | Xano `behavioral_event` | Raw events with user/device IDs, timestamps, exact coordinates (for now) | Xano application code only |
| Layer 2 | `demand_observation` | Counts per neighborhood × category × window. No user, device, or session IDs. Small cells suppressed. | Forecast pipeline |
| Forecast | `demand_forecast` | Scores per run | Forecast API |

**Hard rule:** user_id, external_user_id, device_id, email, push token, coordinates, raw query text, gender, and sensitive tags never reach the forecast pipeline or any report.

### 7.2 Entities

| Entity | Track | Layer | Key fields |
|---|---|---|---|
| `user_preference` | 1 | Xano | See 5.6.2 |
| `conversation_state` | 1 | Xano | session_id, active_topic, last_shown, origin |
| `neighborhood` | 2 (shared reference) | reference | neighborhood_id, name, city_id, boundary polygon, active_for_pilot |
| `demand_observation` | 2 | 2 | PK (neighborhood_id, category, window_start); query_count, interaction_count, checkin_count; demand_score 0-100; source (`real` / `proxy` / `synthetic`) |
| `context_feature` | 2 | 2 | neighborhood_id, window_start, weather fields, event_rank, sports_flag, day_type |
| `forecast_run` | 2 | forecast | run_id, model_version, started_at, status (`running` / `failed` / `active` / `superseded`), degraded_inputs |
| `demand_forecast` | 2 | forecast | run_id, neighborhood_id, category, window_start, score 0-100 |
| `proactive_consent` | 2 | Xano | user_id, granted_at, revoked_at, consent_text_version |
| `notification_preference` | 2 | Xano | user_id, categories, weekly_limit, quiet_hours, sensitive_interests_enabled |
| `proactive_notification` | 2 | Xano | alert_id (opaque), user_id, run_id, neighborhood_id, category, window_start, status, sent_at, opened_at, dismissed_at |
| `recommendation_item` | 2 | Xano | alert_id, rank 1-3, venue_or_event_id, reason_codes |

**Categories:** venues, restaurants, events, activities (sponsor's four).

### 7.3 Demand score definition (TBD)

**Proposal:** for each neighborhood and category, the score is the percentile of the window's activity relative to that neighborhood's own history for the same time of week. A 90 means "busier than 90% of comparable windows here." The alternative is a city-wide absolute scale.

### 7.4 Consent, location, and security

**Consent (NF-011).** Signup terms alone may not be the "explicit consent" the sponsor's requirement describes. **Proposal:** separate plain-language opt-ins for (a) proactive alerts and (b) sensitive interests, and keep push permission as a distinct step.

**Exact coordinates (D5).** This changes NF-009 and needs *sponsor approval*.
- Coordinates are used only at request time to resolve the neighborhood and distance. The aggregation job converts events to `neighborhood_id` and drops coordinates before Layer 2.
- Exact location is likely "sensitive data" under the Texas privacy act, which requires clear affirmative consent. *To confirm; the team is not giving legal advice.*
- Retention period for stored coordinates: TBD.
- Remove the unconditional console log that prints coordinates (code analysis F-14).

**Training data (NF-010).** Models train on anonymized aggregates only. The pipeline must include an automated check that no identifier fields exist in any model input.

**Small-cell suppression.** Cells with fewer than *k* events are dropped or merged (k TBD). This matters most for sparse early data.

**Security notes for the pieces we touch**
- `send-notification` is currently unauthenticated. The trigger must send from Xano server-side with authentication, **not** through that public route.
- OneSignal initializes before any consent signal. Alert opt-in should be gated separately; review whether initialization should wait.
- Forecast API: HTTPS, API key from environment variables, no user data, rate limited.
- Three overlapping identifier systems exist (`device_id`, `external_user_id`, `user_id`/`session_id`). All are dropped in aggregation.
- Deletion is a soft delete today. Deleted users must be excluded from triggers immediately, and their preferences and notification records handled by the retention rule the sponsor confirms.

**Fairness.** Sparse early data can cause uneven neighborhood coverage. Track forecast quality per neighborhood and disclose which neighborhoods are in the pilot.

---

## 8. Integration touchpoints

| Area | Track | Existing piece | Change |
|---|---|---|---|
| Chat endpoint | 1 | `/api/genie/message` → Xano chat endpoint | Add conversation state, `origin`, compact preference summary; intent handling; prompt rewrite (in Xano) |
| Profile | 1 | `/api/genie/social-profile` | Extend to the `user_preference` model |
| Signals | 1+2 | `/api/genie/track-signal`, log-venue/event-interaction | New event types (5.9, 6.6) |
| Consumer UI | 1 | `SinglePageGenieApp.tsx` (about 5,400 lines) | New components in separate files: pick cards, chips, onboarding, preferences screen |
| Client API | 1+2 | `publicApiClient.ts` | Functions for preferences, consent, notification settings, picks |
| Booking links | 1+2 | `maps.ts`, venue URLs | Verify and connect (5.8) |
| Push registration | 2 | `/api/genie/register-push-token`, `NotificationsBoot.tsx` | Gate alert opt-in separately; store consent |
| Open tracking | 2 | `/api/genie/notification-opened` | Link to `alert_id`; record time-to-open |
| Deep link | 2 | `?screen=` routing | Add `picks` screen |
| Xano | 1+2 | Scheduled tasks, tables, endpoints | New tables (7.2), aggregation job, trigger job, forecast tool |

**Prerequisite for both tracks:** confirm sandbox and Xano access, because prompts, preferences, aggregation, and the trigger all live there.

---

## 9. Evaluation (bridge to Checkpoint 4)

| Question | Track | Measure | Target |
|---|---|---|---|
| Are picks relevant? | 1 | Pick taps, saves, booking clicks, rejection rate; user-testing ratings | TBD |
| Does intent handling work? | 1 | Accuracy on a hand-labeled test set of new / follow-up / direct messages | TBD |
| Is cold start working? | 1 | Signals needed to reach `learning` tier; early-session tap rate for new users; onboarding completion and skip rate | TBD |
| Is chat still fast? | 1 | End-to-end latency | Under 2 s (NF-001) |
| Can users correct Genie? | 1 | Preference edit and removal success in user testing | Pass |
| Is the forecast useful? | 2 | Error versus seasonal-naive baseline on held-out data; how often true top neighborhoods appear in predicted top-k | Beats baseline (number TBD) |
| Is the API fast and fresh? | 2 | p95 latency; run age | Under 500 ms; fresher than staleness threshold |
| Do users respond? | 2 | Notification **open rate** and **time to open** (sponsor's chosen measures) | Baseline set in pilot |
| Is it annoying? | 2 | Dismiss rate, turn-off rate, cap compliance | Cap compliance 100% |
| Is privacy intact? | 1+2 | Automated check: no identifiers in model inputs; consent gating; deletion exclusion | Zero violations |
| Is it accessible? | 1+2 | Manual and automated checks on chat cards, onboarding, settings, notification actions (WCAG 2.2 AA) | Pass |

**Caveat:** until real data exists, forecast metrics come from synthetic and proxy data and must be labeled that way.

---

## 10. Rollout plan

**Ordering change to communicate.** The Checkpoint 1 plan the sponsor saw put the data pipeline on Oct 3, forecast prototype on Oct 17, and notification prototype on Oct 31 (all proposed dates). Putting Track 1 first will likely move those dates. Tell the sponsor before committing to new ones.

| Phase | Track | Deliverable | Date |
|---|---|---|---|
| 0 | both | Sprint 0 documentation and report (Xano-side status to confirm) | Was Sept 26 (confirm status) |
| 1 | 1 | Design confirmed with sponsor: scope, ownership, prompt and orchestration boundaries | TBD |
| 2 | 1 | Preferences: `user_preference` model, quick-pick onboarding, in-chat learning, migration of existing tags | TBD |
| 3 | 1 | Conversation state, intent handling, system prompt rewrite (sandbox) | TBD |
| 4 | 1 | Booking and maps handoffs connected; new logging event types live | TBD |
| 5 | 1 | Track 1 evaluation and sponsor review | TBD |
| 6 | 2 | Data pipeline: schema, aggregation, synthetic generator, context ingestor | TBD (CP1 said Oct 3) |
| 7 | 2 | Forecast prototype: baseline, model, batch scorer, API, evaluation report | TBD (CP1 said Oct 17) |
| 8 | 2 | Notification prototype: trigger, gates, picks screen, consent, deep link | TBD (CP1 said Oct 31) |
| 9 | 1 | Chat page UX changes (5.7): small front-end work, open for discussion, deferred; can be done any time after phase 3 | TBD |
| 9b | 1 | Optional preference-editing UI (after team review) | TBD |
| 10 | 2 | Real-data retraining and external data sources | After real data exists (about Q2 2027) |

Phase 6 (data pipeline) can start in parallel with Track 1 phases 4-5 if the team has capacity, since it does not depend on the chat UI. All work stays in the sandbox until Mr. Roundtree reviews and approves. Turnover milestone: April 23.

---

## 11. Open questions

**For the sponsor**
1. Approve adding Track 1 (chat improvements) to our scope, and the order (Track 1 first). This goes beyond Part 6.2-6.4 of his document.
2. How does Track 1 relate to his team's multi-agent redesign? Who owns the system prompt and orchestration, and can we edit them in the sandbox?
3. Approve the NF-009 change to exact coordinates (D5), including the consent and retention approach.
4. Do signup terms satisfy NF-011, or should proactive alerts get their own opt-in? Should sensitive interests default to off?
5. Do proactive alerts share the N-009 cap? What lead time and quiet hours? What defines "busy" (threshold)?
6. Do tier and Boost multipliers apply to proactive picks? (Ads never do.) Is changing the ranking blend for cold start acceptable?
7. Which Houston pilot neighborhoods? Is synthetic and proxy data acceptable until real data exists?
8. Who builds raw event capture (D-001/D-002): us or WS-5? What is the sandbox and Xano access status?
9. Hosting choice and budget approval for the forecast service and any data API keys.
10. What ride, ticket, and reservation handoffs already exist?
11. Are any users under 18? Should age bands include 45+?

**For the team**
1. The actual list of chat page UX changes (section 5.7 is a placeholder; deliberately deferred and open for discussion).
2. Whether to keep raw query text in logs (5.9).
3. Demand score definition (7.3), threshold, small-cell *k*, staleness threshold.
4. Sports schedule data source.
5. Whether our forecast service calls PredictHQ and OpenWeatherMap itself or reads what Xano already ingests (reading avoids duplicate API cost).
6. Which optional preference-editing UI ideas to keep (5.6.4).
7. Whether to send from a degraded-input forecast.

**To verify (assumptions)**
- Whether application logic maintains the `genie_venues.neighborhood_id` mapping; the Xano sandbox schema has the integer field but does not declare a table reference. See [GEN-007 findings](architecture/xano_tables.md#observations).
- Whether to add explicit `active_topic`, `last_shown`, and `origin` state to Xano sessions.
- Whether the v2 AI payload wrapper should be called by the active v2 handler.
- Which reservation field, `reservation_url` or `opentable_url`, should be canonical.
- Whether `notification_opened` can carry an `alert_id`.

---

## Appendix A: Requirement traceability

| Requirement | Where addressed |
|---|---|
| 6.2 Demand forecast, Level 1 | Section 6.2 |
| 6.3 Proactive trigger system | Sections 6.3-6.5 |
| 6.4 Documentation | This file, plus later model and city-expansion guides |
| 6.5 Synthetic data until real data exists | Section 6.2 |
| Track 1 chat improvements | **Not assigned to us in the sponsor's Part 6.** Needs approval (section 1 scope note). Related: WBS 2.2 covers ranking for proactive picks only. |
| Locked principles (consumer relevance, no ads, learn through conversation) | Design principles, 5.4, 6.4 |
| NF-001 Genie under 2 s | 5.10, 9 |
| NF-002 Under 500 ms | 6.2 |
| NF-004 Batch max 25 rows | 6.2, 6.3 |
| NF-006 City-agnostic | `neighborhood` and `city_id` entities; no hardcoded Houston logic in the model |
| NF-008 Quarterly retraining | 6.2 (pipeline supports scheduled retraining) |
| NF-009 Neighborhood-level location | **Changed by D5** (needs approval) |
| NF-010 Aggregate-only training | 7.1, 7.4 |
| NF-011 Explicit consent | 7.4 |
| NF-012 Keys in environment variables | 6.2, 7.4 |
| INT-038 REST endpoint | 6.2 |
| N-009 Notification cap | 6.3 |
| N-010 Deep link to specific screen | 6.4 |
| N-014 Predictive push | 6.3-6.4 |
| AG-010 Proactive suggestions | 6.3-6.5 |
| D-001 to D-006 Event capture and classification | 5.9, 7.1, 6.2 (ownership TBD) |
| D-004 Rejection signals | 5.7, 5.9 |
