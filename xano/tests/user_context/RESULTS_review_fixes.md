# Review fixes A and B: test results (2026-10-28)

Two findings of `USER_CONTEXT_INTEGRATION_REVIEW.md`, on branch `flutter-v2-sandbox-tamu-capstone`, datasource `tamu_capstone`, test users only (`test-learn-` ids, deleted after each run). Changelog rows #110–#115. The other findings (C–F) were not shipped. C was deployed briefly and then reverted; the pre-fix test passes again.

## A. Web app on the conversation v1 chat endpoint
4200 (Genie_Dev, the web app's copy) is now 4369's body (1.7.0); only `api_group` differs. The web route forwards `new_conversation` / `turn_hint` and passes the conversation fields through. The client starts a new conversation on the first message after a page load.

| Check | Result |
|---|---|
| `xano/tests/chat/endpoint_parity.py`: identical code; same response keys and turn kinds for request, follow-up, `new_conversation`, `turn_hint` (debug on and off); debug blocks hidden without `debug`; JSON input errors | 23/23 |
| `app/api/genie/message/route.test.ts` | 7/7 |
| Mapper tests (`genieMappers.test.ts`, conversation fields) | 2 new, pass |
| Local web app (preview) | request → `turn_kind: request`, `turn_index` 1, 5 more-nearby; follow-up "does the first one have a patio?" → same token, `followup`, refers to request 1, answered about the first pick; reload → `new_conversation: true`, new token |

## B. Saved-preference rules in the prompts
Section 7 is added to the pick and converse system prompts only when the user has saved preferences (versions `pick-v3.1` / `converse-v1.1`), plus a line after the preference text to keep the reply language.

B0, prompts without a context: SHA-256 identical to `pick-v3` / `converse-v1` before and after every change (`prompt_snapshot.py`).

`prompt_rules_tests.py`, 3 runs of each case, final wording (round 3, run `r1793234892`): **24/27**.

| Case | Result |
|---|---|
| B0b chat with a context uses `pick-v3.1` / `converse-v1.1` | pass |
| B1 like Rooftop, "quiet coffee shop to work": no rooftop forced in | 3/3 |
| B2 dislike Loud & Lit, "bar for drinks tonight": Lost & Found (energetic, dancing) not picked; without a context it is picked 2nd | 3/3 |
| B3 dislike, asks for a loud dance club: energetic venues still picked | 3/3 |
| B4 wording on pick replies (no profile talk, lists, dislikes) | 6/6 |
| B5 "which of these is better for me?" | **1/3, known gap**: always picks the calm venue, but explains with "aligns with your preference…" / "good for avoiding loud…" |
| B6 "does the first one have a patio?": no preference talk | 3/3 |
| B7 "actually somewhere loud and lively to dance": energetic venue picked | 3/3 |
| B8 Spanish request with a saved like | 2/3 (the miss was the app's English fallback text, i.e. no model reply; round 2 was 3/3) |

History: round 1 23/27 (B5 0/3, B8 2/3); round 2 added the language line and examples, 24/27 (B5 0/3, B8 3/3); round 3 added a final word check, 24/27 (B5 1/3, B8 2/3). The plan allowed 3 rounds; B5 is shipped as a known gap (decision 2026-10-28).

## Regression (latest `main` with Zach's GEN-071 v2, plus these changes)

| Suite | Result |
|---|---|
| `xano/tests/learning/learn_job_tests.py` | 44/44 (run `r1793235528`) |
| `xano/tests/user_context/user_context_e2e.py` | 14/14 |
| Zach's C4 conversation tests on 4369 | 0 failed turns, C4-04 found, C4-05 not found |
| The same with the chat call on 4200 | 0 failed turns, C4-04 found, C4-05 not found |
| `npm run lint` / `typecheck` / `test` / `build` | 0 errors (47 warnings) / pass / 47/47 / pass |
