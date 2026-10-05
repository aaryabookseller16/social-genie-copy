# Genie Base Improvements

## Summary

This document outlines the base improvements Genie needs to become more useful. Once they are in place, the predictive layer becomes simple to add: it is a scheduled job that runs at a set cadence and sends Genie the same templated prompt each time. Only a few variables change per run, such as the user's location or the time of day.

In other words, the predictive layer is a normal Genie call with its own dedicated system prompt for this specific task. It needs no new architecture.

> **Note:** Items marked **(open)** are undecided questions, not settled plans. They are collected in [Open Questions](#open-questions) at the end. Details come from `docs/genie_plan.md` (draft v0.2); section numbers like "plan 5.4" refer to it.

**Predictive layer details still open**
- **(open)** What cadence should the job run at: every 6 hours, 3 days, 1 week, or something else?
- **(open)** Is location and time of day really the only thing that changes between runs?
- **(open)** How does this relate to the plan's Track 2? The plan builds a demand forecast model and sends templated notifications with no LLM at send time (plan 6.4). A scheduled Genie prompt is a different design, so decide whether it replaces, wraps, or sits next to the forecast. This is likely a sponsor decision.

## Main Improvements

1. [Improved system prompts](#1-improved-system-prompts)
2. [User context files](#2-user-context-files)
3. [Tools available to the model](#3-tools-available-to-the-model)
4. [Chat window UI fixes](#4-chat-window-ui-fixes)

---

## 1. Improved System Prompts

The system prompt lives in Xano (AI orchestration) and is one of the main deliverables of the plan's Track 1 (chat improvements). The plan proposes a rewrite with six sections.

### Proposed structure (plan 5.4)

| # | Section | What it covers |
|---|---|---|
| 1 | **Role and principles** | Relevance first, no ads, honest about boosts, learn through conversation, never mention or infer sensitive traits. |
| 2 | **Response structure** | 3 picks with a one-line reason each, then about 12 more nearby. Follow-ups are short. Direct questions get direct answers. No invented venues: only items returned by tools. |
| 3 | **Thinking steps** | (a) classify the message; (b) resolve place and time; (c) read active preferences and conversation state; (d) call tools; (e) rank; (f) phrase; (g) check the reply against the rules. |
| 4 | **Tools and skills** | What each tool is, when to use it, what it returns, and what to do on failure. |
| 5 | **Good and bad examples** | One set for each message case (below), and for reason lines. |
| 6 | **Guardrails** | Never expose other users' data, never present uncertain data as certain, never use gender or sensitive tags for ranking, say plainly when nothing matches. |

### Message cases the prompt must separate (plan 5.3)

| Case | Example | Expected behavior |
|---|---|---|
| **New request** | "Actually, somewhere for live music Saturday" | Replace the active topic, run a fresh search and ranking, show new picks. |
| **Follow-up** | "What about the second one?" / "Anything cheaper?" | Resolve references against the last items shown, keep the active topic, refine or answer about those items. |
| **Direct question** | "What time does it close?" | Answer directly from the data, with no new recommendation list. |

**Ambiguity rule (proposed):** if a message could be a follow-up or a new request, choose the more likely one and state the assumption ("Sticking with rooftop bars in Midtown. Say the word if you want something different."), or ask at most one short clarifying question.

### Example reason-line phrasing (plan 5.4)

- **Good:** "Fits your taste for rooftop spots, and it's a 6-minute walk from where you are."
- **Bad:** "Because your profile says you are X."

Forecast phrasing, for the predictive layer and later chat use:
- **Good:** "Midtown is expected to be busier than usual tonight, so I'd book ahead."
- **Bad:** "Midtown demand score is 87, so it will be packed."

### What the prompt depends on

The rewritten prompt refers to things that don't exist yet. Until they do, leave marked placeholders instead of finished sections.

- **Conversation state** (active topic, last shown items, origin) and **intent classification**. The Xano endpoint currently has no explicit `active_topic`, `last_shown`, or `origin` fields.
- **The tool list** (section 3 below).
- **How user context is presented** (section 2 below).

### Needed for implementation

- Specific changes are listed in the Genie improvement plan on GitHub (GEN-018).
- Deploy in the sandbox only. Sponsor review is required before production.
- **Test before and after.** Use a hand-labeled test set of new, follow-up, and direct messages. Acceptance criteria: no invented venues in test runs, and reason lines that follow the good examples.
- **Measure latency.** The sponsor target is under 2 seconds end to end. Longer prompts and tool calls add time.
- **Find out who owns the prompt.** The sponsor's team has a multi-agent redesign, so coordinate before editing the prompt or orchestration.

---

## 2. User Context Files

Each user gets a context file that Genie reads and updates. This is how Genie learns about a user over time. In the plan this is the preferences model (plan 5.6).

### Creation

- Build an initial job or script that creates the user context file at sign-up.
- **(open) Cold start for users who use Genie before signing up:** the idea is to store a context file keyed to the device ID, then link it to the user account at sign-up so early usage is not lost. Not yet confirmed as the approach, and it needs consent and retention rules.
- The plan also layers other cold-start techniques (plan 5.6.1): skippable quick-pick onboarding cards, one light in-chat question per session for the first 3 sessions, a popularity fallback, and an exploration slot for new users.

### Design questions

- **(open) Depth of personal data:** how detailed should the file be? The plan collects age as a range, gender only as an optional profile field that is never used for ranking, and does not collect race. Exact coordinates are used only at request time.
- **(open) Inferred preferences:** how do we identify preferences from past usage, beyond what the user states explicitly? The plan infers from logged events (taps, saves, rejections, booking clicks) and requires a minimum amount of consistent evidence (placeholder: 3 signals in 30 days).
- **(open) Usage history:** how should past usage be structured in the file?
- **(open) Model consumption:** how should the context be presented so the model understands it efficiently (clarity and token cost)? The plan wants a compact active-preference summary.

### Rules the plan already sets for stored preferences (plan 5.6.2)

- Each preference records its source (`stated`, `inferred`, `connected_account`), confidence, evidence count, status, and sensitivity.
- **Stated beats inferred.** Inference never overrides a stated preference.
- **Removal is a tombstone.** A removed preference is kept as removed so inference never re-adds it.
- Inferred preferences decay if not reinforced and expire below a confidence floor.
- Sensitive preferences (community and music tags) are excluded unless the user opts in.

### CRUD functions for the user profile

| Function | Rules |
|---|---|
| **Create** | Runs once per user, at sign-up. |
| **Read** | Available to Genie. |
| **Update** | Available to Genie. **This is the most important part of the system, because it is how Genie learns.** **(open)** How update works for Genie still needs to be planned. Note that the plan currently makes the preference tool read-only for the model ("the model cannot edit"), so letting Genie propose updates is a change to decide on. |
| **Delete** | Only on explicit user request. If a user deletes their account, the context file is deleted after a retention period. **(open)** Proposed: 3 months with no reactivation. Not available to Genie. |

Genie should only have access to **Read** and **Update**.

---

## 3. Tools Available to the Model

Decide which tools Genie can call. The plan's tool table (plan 5.5) and our additions:

| Tool | Purpose | Status in plan |
|---|---|---|
| City graph and catalog search | Find venues and events by category, place, vibe | Existing / confirm what it exposes |
| Venue and event lookup | Hours, address, links | Existing |
| User context read | Compact active-preference summary | New |
| User context update | Let Genie propose changes to the file | **Not in the plan.** The plan's preference tool is read-only. |
| Booking and maps link builder | Action links per pick | Connect existing links |
| Forecast lookup | Expected busyness for a neighborhood and time window | New in Track 2, optional later in chat |

- **(open)** Any other tools?

Each tool must also be described in the system prompt (section 1, part 4).

---

## 4. Chat Window UI Fixes

**Needed for implementation**
- Better layout
- Updated color scheme, consistent with the other pages
- Edit past prompts button
- Quote past prompt function
- **(open)** Any other improvements?

**Relationship to the plan:** the plan lists chat page UX (plan 5.7) as open for discussion and intentionally deferred, with a placeholder list of pick cards, follow-up chips, a context indicator, "Why this pick?", thumbs up or down, and accessibility. Edit past prompts and quote past prompt are not in that list yet. New UI should be built as separate components, not added to the roughly 5,400-line `SinglePageGenieApp.tsx`.

---

## Open Questions

**Predictive layer**
- What cadence should the scheduled job run at (6 hours, 3 days, 1 week)?
- Are location and time of day the only variables that change per run?
- Does a scheduled Genie prompt replace, wrap, or sit next to the plan's forecast model and templated notifications?

**System prompts**
- Who owns the system prompt and orchestration, given the sponsor's multi-agent redesign?
- Which prompt sections can be written now, and which wait for conversation state, the tool list, and the context format?

**User context file**
- Should pre-signup usage be stored by device ID and linked at sign-up?
- How deep should the personal data go?
- How do we infer preferences from past usage, beyond explicit statements?
- How should past usage be structured in the file?
- How should the context be presented to the model for efficiency?
- How should Genie's update function work, given the plan's preference tool is read-only? (Most important.)
- Is 3 months with no reactivation the right retention period after account deletion?

**Tools**
- What tools, beyond city graph read and context read/update, should Genie have?

**Chat UI**
- What other improvements belong on the list?
