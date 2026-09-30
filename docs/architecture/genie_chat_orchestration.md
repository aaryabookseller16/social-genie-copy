# GEN-008: Genie Chat Orchestration and Handoffs

**Inspection scope:** Xano workspace `Social Bees` (workspace 1), branch `flutter-v2-sandbox`, and the web app checked on 2026-09-29. This is a metadata/code-path audit; it does not establish runtime traffic or production behavior. No Xano objects were changed.

## Prompt and request flow

1. The web app posts to `/api/genie/message`. The Next.js route normalizes the request and proxies it to `genie/ep_genie_chat_v2_dev` in the Xano `Genie_Dev` API group.
2. The Xano endpoint calls `genie/fn_genie_handle_message_v2_dev`.
3. `genie/fn_genie_detect_query_mode_dev` classifies the message as `venue`, `event`, `neighborhood`, or `ambient` (default `venue`). Neighborhood recognition uses a hard-coded Houston neighborhood list. The v2 handler routes venue and event modes through `genie/fn_genie_handle_message_dev`; neighborhood and ambient modes use dedicated context/recommendation paths and `genie/fn_genie_get_reply_v2_dev` replies.
4. The base system prompt is assembled line by line into `system_text` in `genie/fn_genie_build_ai_payload_dev`. The prompt is Xano function code, not a prompt table, separate AI agent, or text in `app/api`. To edit it, an authorized editor changes that function in the Xano function stack/XanoScript editor on the sandbox branch.
5. `genie/fn_genie_build_ai_payload_v2_dev` exists; it calls the base payload builder and can append weather, neighborhood, and ambient context to the first system message. The inspected `fn_genie_handle_message_v2_dev` branches do not directly call this v2 payload wrapper, so its use in the active v2 path is not established by this audit.
6. The endpoint accepts `session_token`, `session_id`, and `session_query_number`; the inspected request contract does not include explicit `active_topic`, `last_shown`, or `origin` fields from the plan.

The separate app route `/api/genie/prompt` maps signup/upgrade prompt visibility and dismissal events. It is not the Genie system prompt. The `genie_prompt_log` table likewise tracks user interactions with prompts, not the chat system instructions.

## Mode fields

- Xano returns `query_mode` and `reply_mode`. `query_mode` is the request classification; `reply_mode` selects a response branch such as `neighborhood_intro` or `ambient_tonight`.
- Xano's inspected chat endpoint does not return `response_mode`. The Next.js `/api/genie/message` route derives it: `structured_results` when venues or events are present, otherwise `text_reply`.
- Therefore the plan's `response_mode` assumption should be treated as an app response contract, distinct from Xano's `reply_mode`.

## Booking, ticket, ride, and directions links

| Handoff | Xano data/path | App behavior |
|---|---|---|
| Venue reservation | `genie_venues` has `reservation_url`/`reservation_platform` and `opentable_url`/`reservation_provider`. The public event-detail endpoint builds its reservation CTA from the linked venue's `opentable_url`. | Genie venue detail uses `reservation_url`; the public event page uses the Xano `reservation_cta`. These are outbound URLs, not reservation API transactions. The two reservation fields should be reconciled before future changes. |
| Event tickets | `genie_social_events` has `ticket_url`, `ticket_provider`, and ticket-price fields. `genie/ep_get_event_by_slug_dev` builds a `ticket_cta` from the event's `ticket_url`. | Event detail opens the returned ticket URL in a new tab and logs the external click. |
| Rides | `genie_venues` has `uber_deeplink`; the public event-detail endpoint returns a ride CTA when the linked venue has that field. | The public event page opens the returned Uber link. The in-app event detail also constructs an Uber URL from the event venue address. Uber is the only ride provider identified in the inspected code; no Lyft integration was found. |
| Directions | `genie_venues` has `google_maps_url`, coordinates, and address. The public event endpoint returns the venue object, not a separate directions CTA. | The app opens `google_maps_url` when available or constructs a Google Maps URL from coordinates/address. |

These are outbound deep links or URLs; no native booking, ticketing, or ride API integration was identified. The public event page logs external clicks; the in-app flows use their existing event/venue interaction logging paths.

## Scope limits and follow-ups

- Findings are for `flutter-v2-sandbox`; live `v1` was not inspected.
- This audit identifies the function that contains the base system prompt and how the web app reaches the Xano chat endpoint. It does not identify a named human owner for prompt/orchestration changes.
- Confirm whether the v2 payload wrapper is intended to be wired into the active chat handler.
- Decide whether conversation state needs explicit `active_topic`, `last_shown`, and `origin` fields.
- Reconcile `reservation_url` and `opentable_url` as the canonical reservation field.
