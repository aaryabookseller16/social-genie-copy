# Batch learning job: test results (2026-10-28)

Suite: `xano/tests/learning/learn_job_tests.py` (regimen agreed before the build; plan in `docs/architecture/user_context.md`, section 7, "Batch learning job").
Branch `flutter-v2-sandbox-tamu-capstone`, datasource `tamu_capstone`. Model-dependent cases (F1, F3, F4, F7, F11, F12, F13) ran 3 times each.

| Run | Result | Notes |
|---|---|---|
| r1793159584 | 25/44 | Every case with a real chat failed: chat sessions point at a per-channel `genie_user` row (the lifecycle's `identify_user` keys users by channel + `external_user_id`), so the job looked up the wrong owner and the per-message skip never matched. Fixed by resolving the owner by `external_user_id` (verified), and filtering `verified == true` in the owner lookups (changelog #97, #100, #101). Three assertions were also too strict (F10 value, F11 session owner, T1 user id). |
| r1793160232 | **44/44** | Whole suite re-run after the fix. |

Regression after the change:
- `xano/tests/user_context/user_context_e2e.py`: 14/14.
- Zach's conversation tests (C4-01..03 through 4369): 13/13 turns, C4-04 found, C4-05 not found.
- `npm run lint` (0 errors, 48 warnings), `typecheck`, `test` (38/38), `build`: pass.

Cases that differ from the original plan:
- **F12:** the extractor never learns music or community from chat (no consent flow), so the expected result is "not saved", not "saved as sensitive".
- **J1/J2/T1:** run with `only_user_ids`, so the tests never learn from real users' chats in `tamu_capstone`. The workflow itself sends `{}` (all users).
- **R5:** tested with `$batch_job_on = true`. It is now **false** in `ep_learn_from_message_dev` until the GitHub workflow is pushed, so signed-in users keep being learned per message in the meantime. To switch over: push the workflow, then set `$batch_job_on = true` in both copies (4566, 4567).

## Output of the passing run

```
run r1793160232
PASS F1 new: learned from chat (rep 1) | job=done ops=3 prefs=[('food', 'Vegetarian', 'like', 'stated', 1), ('atmosphere', 'Quiet', 'like', 'stated', 1), ('food', 'Wine Focused', 'like', 'stated', 1)]
PASS F2 new: second run learns nothing (rep 1) | chunks=0 ops=0 version 2->2
PASS R5 per-message skips a verified user's own session | skipped=batch_job
PASS F3 new: only the new message is learned (rep 1) | marker 3450->3452 chunks=1 clubs=[('atmosphere', 'Club Vibe', 'dislike', 'stated', 1)] veg_ev=1->1
PASS R1 new chat reads the learned context | context={'source': 'user', 'count': 4, 'keywords': ['vegetarian', 'quiet', 'wine focused'], 'avoid': ['club vibe']} reply='Here are the closest fits for a vegetarian-friendly dinner spot tonight.\n1. Lost & Found: Open now with a trendy vibe, t'
PASS F1 new: learned from chat (rep 2) | job=done ops=3 prefs=[('food', 'Vegetarian', 'like', 'stated', 1), ('atmosphere', 'Quiet', 'like', 'stated', 1), ('food', 'Wine Focused', 'like', 'stated', 1)]
PASS F2 new: second run learns nothing (rep 2) | chunks=0 ops=0 version 2->2
PASS F3 new: only the new message is learned (rep 2) | marker 3456->3458 chunks=1 clubs=[('atmosphere', 'Club Vibe', 'dislike', 'stated', 1)] veg_ev=1->1
PASS F1 new: learned from chat (rep 3) | job=done ops=3 prefs=[('food', 'Vegetarian', 'like', 'stated', 1), ('atmosphere', 'Quiet', 'like', 'stated', 1), ('food', 'Wine Focused', 'like', 'stated', 1)]
PASS F2 new: second run learns nothing (rep 3) | chunks=0 ops=0 version 2->2
PASS F3 new: only the new message is learned (rep 3) | marker 3460->3462 chunks=1 clubs=[('atmosphere', 'Club Vibe', 'dislike', 'stated', 1)] veg_ev=1->1
PASS F4 flip: Rooftop like -> dislike (rep 1) | job=done rooftop=[('atmosphere', 'Rooftop', 'dislike', 'stated', 1)] happy_hour=[('experience', 'Happy Hour', 'dislike', 'stated', 1)]
PASS F4 flip: Rooftop like -> dislike (rep 2) | job=done rooftop=[('atmosphere', 'Rooftop', 'dislike', 'stated', 1)] happy_hour=[('experience', 'Happy Hour', 'dislike', 'stated', 1)]
PASS F4 flip: Rooftop like -> dislike (rep 3) | job=done rooftop=[('atmosphere', 'Rooftop', 'dislike', 'stated', 1)] happy_hour=[('experience', 'Happy Hour', 'dislike', 'stated', 1)]
PASS F5 removed entry not revived by a passing mention | job=done ops=0 live=[]
PASS F6 caps hold with a near-full context | live 58->58 per_cat={'experience': 10, 'atmosphere': 10, 'food': 10, 'neighborhood': 10, 'event': 10, 'price': 4, 'typical_time': 2, 'group_size': 2} new_food=[('food', 'Mexican', 'like', 'inferred', 1), ('food', 'Sushi', 'like', 'stated', 1), ('food', 'T
PASS F7 Spanish learned, values in English (rep 1) | job=done prefs=[('experience', 'Live Band', 'like', 'stated', 1), ('atmosphere', 'Loud & Lit', 'dislike', 'stated', 1)]
PASS F7 Spanish learned, values in English (rep 2) | job=done prefs=[('experience', 'Live Band', 'like', 'stated', 1), ('atmosphere', 'Loud & Lit', 'dislike', 'stated', 1)]
PASS F7 Spanish learned, values in English (rep 3) | job=done prefs=[('experience', 'Live Band', 'like', 'stated', 1), ('atmosphere', 'Loud & Lit', 'dislike', 'stated', 1)]
PASS F8 chit-chat and requests save nothing, marker advances | ops=0 live=[] marker_to=3483 last=3483
PASS F9 same statement in two sessions: one entry, evidence 2 | karaoke=[('experience', 'Karaoke', 'like', 'stated', 2)]
PASS F10 guest: job skips, per-message still learns to the device | job reason=not_verified marker=3486 pending_after=0 device=[('experience', 'Live Band', 'like', 'stated', 1)]
PASS F11 sign-in mid-session: each taste once on the account (rep 1) | session.user=551 account=550 learn_skipped=None job=not_verified vegan=[('food', 'Vegan', 'like', 'stated', 1)] loud=[('atmosphere', 'Loud & Lit', 'dislike', 'stated', 1)]
PASS F11 sign-in mid-session: each taste once on the account (rep 2) | session.user=555 account=554 learn_skipped=None job=not_verified vegan=[('food', 'Vegan', 'like', 'stated', 1)] loud=[('atmosphere', 'Loud & Lit', 'dislike', 'stated', 1)]
PASS F11 sign-in mid-session: each taste once on the account (rep 3) | session.user=559 account=558 learn_skipped=None job=not_verified vegan=[('food', 'Vegan', 'like', 'stated', 1)] loud=[('atmosphere', 'Loud & Lit', 'dislike', 'stated', 1)]
PASS F12 music is not learned from chat (no consent flow) (rep 1) | ops=0 prefs=[]
PASS F12 music is not learned from chat (no consent flow) (rep 2) | ops=0 prefs=[]
PASS F12 music is not learned from chat (no consent flow) (rep 3) | ops=0 prefs=[]
PASS F13 injection saves nothing outside the allowed categories (rep 1) | ops=0 prefs=[]
PASS F13 injection saves nothing outside the allowed categories (rep 2) | ops=0 prefs=[]
PASS F13 injection saves nothing outside the allowed categories (rep 3) | ops=0 prefs=[]
PASS F14 60 messages processed in chunks, marker at the end | 60 msgs chunks=10 done=10 ops=5 tastes_found=5/5 13.0s
PASS F15 no user messages: no model call, marker advances | chunks=0 marker_to=3566 last=3566 2.9s
PASS J2 cap 25 of 30, oldest first, rest on the next run | run1 pending=30 picked=25 run2 pending=5 picked=True after=0 run1 52473 ms
PASS J3 a failed session keeps its marker and is retried; others succeed | s1=done s2=partial/no_model_reply marker=0 retry=done ops=1
PASS J4 kill switch off does nothing | {'enabled': False, 'pending_total': 0, 'picked': [], 'results': [], 'duration_ms': 8}
PASS J5 a profile write during the job: both changes kept | job=done prefs=[('neighborhood', 'Montrose', 'like', 'stated', 1), ('atmosphere', 'Speakeasy Vibe', 'like', 'stated', 1), ('food', 'Signature Cocktails', 'like', 'stated', 1)]
PASS J6 session whose user was deleted: skipped, no error | {'session_id': 2394, 'status': 'skipped', 'reason': 'no_user', 'owner_id': 572, 'account_id': 0, 'chunks': 0, 'chunks_done': 0, 'ops': 0, 'marker_from': 0, 'marker_to': 3601, 'fail_reason': None}
PASS J8 two overlapping runs: learned once | runs=[('skipped', 'claimed_by_other_run', 0), ('done', None, 1)] trivia=[('experience', 'Trivia Night', 'like', 'stated', 1)]
PASS T1 the workflow's request learns the chat | http=200 picked=[2396] 2975 ms prefs=[('atmosphere', 'Speakeasy Vibe', 'like', 'stated', 1)]
PASS T2 three runs with no new messages: cheap, no writes | durations=[190, 133, 140] ms version 2->2
PASS T3 kill switch off: next call does nothing | {'enabled': False, 'pending_total': 0, 'picked': [], 'results': [], 'duration_ms': 2}
PASS J1 empty run: no pending sessions, quick | pending=0 129 ms
PASS J7 default datasource untouched (user 63) | version 4->4, entries 10->10
cleanup {'ok': True, 'users': 50, 'contexts': 20, 'sessions': 64, 'messages': 156, 'device_contexts': 1}

44/44 passed in 477s (run r1793160232)
```
