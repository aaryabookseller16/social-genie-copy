# Social Bevy Xano Database: Table Reference

**Source:** table descriptions exported from the Xano workspace (Social Bees) on 2026-09-29. The descriptions were written or generated in Xano. The fields, relationships, and branch (`v1` vs `flutter-v2-sandbox`) have **not** been verified. The export lists 118 tables, and the last description is cut off.

**Legend:** ★ means the table is directly relevant to WS-9, the predictive model.

---

## 1. City Graph Automation

These tables confirm that **City Graph is a real ingestion pipeline**, not just a brand name. A "Master Runner" works through cities. Each run discovers raw candidates from Google and IG/FB/web, processes them into venues and events, and logs everything so it can be traced.

| Table | Purpose |
|---|---|
| `genie_cities` | Described as the "single source of truth" for City Graph Automation. Tracks city discovery and build status. |
| `city_graph_cities` | Also described as the "source of truth" for the City Graph Master Runner, with city details and run statuses. |
| `city_graph_master_state` | Stores the Master Runner's cursor and tick status. |
| `city_graph_runs` | One row per automation run (build or refresh), with deterministic counts and status. |
| `city_graph_raw_candidates` | Raw discovered items (Google, IG/FB/web), stored so processing is repeatable and cheaper. |
| `city_graph_run_venues` | Links processed venues back to the run that produced them. |
| `city_graph_events_state` | State of event processing: discovery and enrichment runs. |
| `backfill_job_state` | Status and progress of City Graph backfill jobs. |
| `source_snapshots` | Raw source data kept for compliance and traceability. |
| ★ `neighborhoods` | Neighborhoods and areas within a city: geography, demographics, activity data. |
| ★ `genie_venues` | The main venue inventory: location, categories, social metrics, monetization tiers. |
| `genie_venue_images` | Venue image URLs with type, source, and attribution. |
| ★ `genie_events` | Venue-based events from City Graph Automation, including recurrence rules and ticketing. |

## 2. External Event Ingestion

This is most likely the scheduled "discovery" job Al described (Ticketmaster, SeatGeek, Viator).

| Table | Purpose |
|---|---|
| ★ `genie_external_events` | Events and experiences pulled from external APIs (Ticketmaster, SeatGeek, Viator), tagged for Genie matching. |
| `genie_external_event_tags` | Links external events to taxonomy tags. |
| `genie_external_tag_mapping` | Automatically maps source genres and categories to Social Bevy tags and primary categories. |
| ★ `genie_ingestion_log` | Detailed logs of each ingestion run. |
| ★ `genie_event_calendar` | Major events to monitor, with expected attendance and impact. |
| ★ `worldcup_matches` | World Cup matches: teams, venues, expected crowd. |

## 3. Taxonomy and Tags

| Table | Purpose |
|---|---|
| `genie_tags` | Master taxonomy: canonical labels for events, venues, and user preferences. |
| `genie_tag_affinity` | Weighted relationships between tags. |
| `genie_event_tags` | Links producer social events to tags. |
| `genie_user_tag_preferences` | Normalized user to tag preferences. |
| `genie_event_primary_categories` | Primary categories shown to producers when they create events. |
| `genie_primary_category_mapping` | Maps producer categories to the social preference taxonomy. |
| `category` | Older classification categories (name, slug, image). |
| `hashtags` | Hashtag values. |
| `category_hashtag` | Links categories to hashtags. |
| `user_category` | Categories and hashtags a user has selected. |

## 4. Genie Conversation and Queries

| Table | Purpose |
|---|---|
| `genie_user` | Genie user identity, auth, preferences, activity. |
| `genie_user_profile` | Long-term preference profile, linked to `genie_user`. |
| `genie_session` | Genie sessions: user, token, start and end times, context. |
| `genie_temp_sessions` | Temporary sessions: preferences, conversation history, detected language. |
| `genie_message` | Messages exchanged within a Genie session. |
| `genie_intent_snapshot` | Snapshots of user intent at points within a session. |
| ★ `genie_query_log` | Every query sent to Genie. |
| ★ `genie_query_context` | Query context: user, intent, location, time, environmental factors. |
| `genie_reply_bank` | Predefined replies by intent and scenario. |
| `genie_prompt_log` | Signup and upgrade prompts: displays, dismissals, conversions. |
| `genie_onboarding_question_log` | Every conversational onboarding question, across all channels. |

## 5. Behavioral Signals and Personalization

These are the raw inputs for Levels 1 and 3 of the predictive model.

| Table | Purpose |
|---|---|
| ★ `genie_behavior_signals` | Behavioral signals: interaction types, values, context. |
| ★ `genie_user_venue_interaction` | How users interact with venues: type, rating, context. |
| ★ `genie_saved_venues` | Saved venues, including guest saves. |
| ★ `genie_venue_affinity` | A user's affinity score for each venue over time (description cut off in the export). |
| ★ `venue_checkins` | User check-ins at venues. |
| ★ `user_location_signals` | Location signals used for Social Energy and discovery. |
| ★ `genie_location_history` | Passive location history (users with background location permission). |
| ★ `venue_weather_context` | Real-time weather per venue: temperature, conditions, forecast. |
| ★ `genie_event_rsvp` | RSVP and attendance status. |
| ★ `genie_event_feedback` | Post-event feedback used to refine recommendations. |
| `event_post_survey_responses` | Post-event survey answers: attendance, ratings, feedback. |
| `genie_user_social_profile` | Social preferences and intake status. |
| `genie_social_preferences` | Lifestyle preferences: event categories, music, atmosphere. |
| `genie_user_image_signals` | GPT-4o Vision analysis of profile and feed images. |
| `genie_user_connections` | User to user social graph (friend activity). |
| `genie_follows` | Follow relationships between users and producers. |

## 6. Producers, Social Events, and Content

| Table | Purpose |
|---|---|
| `genie_producer_profiles` | Producer profiles and event metrics. |
| ★ `genie_social_events` | Producer-created social and community events with social metrics. |
| `genie_posts` | Posts by producers and other authors. |
| `genie_post_likes` | Post likes. |
| `genie_comments` | Comments on events and other content, with reply threading. |
| `genie_comment_likes` | Comment likes. |
| `genie_event_galleries` | Event photo galleries. |
| `genie_event_photographers` | Photographer access to galleries. |
| `genie_gallery_photos` | Gallery photo metadata. |
| `genie_gallery_claims` | Users claiming gallery photos. |
| `promoter_analytics_daily` | Daily promoter analytics: followers, event performance, engagement. |

## 7. Messaging and Notifications

| Table | Purpose |
|---|---|
| `genie_message_threads` | Threads between users and producers. |
| `genie_messages` | Messages within those threads. |
| `genie_user_threads` | Threads between two participants. |
| `genie_push_tokens` | OneSignal push tokens. |
| `genie_notifications` | Individual notifications: type, title, body, read status. |
| `genie_notification_log` | Log of every push sent and how the user interacted with it. |
| `genie_notification_preferences` | Per-user notification preferences. |

## 8. Vendors, Offers, and Monetization

| Table | Purpose |
|---|---|
| `genie_vendor` | Vendor profiles linked to a user and a venue, with onboarding status. |
| `genie_vendor_onboarding` | Progress of vendor onboarding. |
| `genie_vendor_analytics` | Daily venue analytics: appearances, views, clicks, engagement. |
| `vendor_placements` | Paid placements (ads): type, targeting, performance. |
| `venue_claim_requests` | Requests to claim a venue, with verification status. |
| `vendor_waitlist` | Vendors waiting to join. |
| `genie_offers` | Subscription perks and scheduled venue specials. |
| `genie_redemptions` | Offer redemptions (user, offer, vendor). |
| `vibbee_offers` | V.I.Bee member offers, linked to events. |

## 9. Influencers and Referrals

| Table | Purpose |
|---|---|
| `influencer_profiles` | Influencer profiles and performance metrics. |
| `influencer_offers` | Influencer offers: codes, commission. |
| `influencer_redemptions` | Redemptions of influencer offers, with commission details. |
| `influencer_venue_partnerships` | Influencer and venue partnerships: rates, bonuses. |
| `referral_codes` | Personal referral codes. |
| `transactions` | Referral earnings ledger (one row per referred user's first Pro conversion). |
| `payouts` | Referrer withdrawal attempts. |
| `payout_locks` | Short-lived lock on the withdrawal flow. |

## 10. Admin, Platform, and Ops

| Table | Purpose |
|---|---|
| `system_settings` | System-wide configuration. |
| ★ `task_run_logs` | Logs of automated task runs, with metrics and payloads. |
| `admin_audit_log` | Admin actions. |
| `analytics_daily_snapshots` | Daily platform metrics: users, memberships, engagement, revenue. |
| `platform_milestones` | Platform milestones. |
| `city_partner_tokens` | API tokens for city partners. |
| `investor_tokens` | API tokens for investors. |
| `content_reports` | Reports of inappropriate content. |
| `user_blocks` | User blocks. |
| `rate_limit_counters` | Rate limit counters per action. |
| `stripe_webhook_log` | Stripe webhook events. |
| `contact_messages` | Contact form submissions. |
| `weekly_pick_signups` | Weekly picks signups (contact info, city). |
| `genie_network_signups` | People interested in joining the Genie network. |

## 11. Likely Legacy (pre-Genie)

These look like an older version of the platform based on naming (capitalized names, `_legacy`, `_0`). Confirm with Al before relying on any of them.

| Table | Purpose |
|---|---|
| `User` | Old user auth and profile: points, purchases, membership plan. |
| `Vendor` | Old vendor details: business info, hours, social links, payment methods. |
| `Vendor_0` | Basic vendor info (appears to duplicate `Vendor`). |
| `Vendor Locations` | Physical locations for vendors. |
| `Offers` | Old offers: pricing, discounts, usage limits. |
| `User Offers` | Links users to offers, with usage and redemption tracking. |
| `redemptions` | Old offer redemptions. |
| `listing` | Vendor listings: pricing, active dates. |
| `influencer` | Old influencer table. |
| `session` | Payment sessions (IDs, customer IDs, payment status). |
| `password_reset` | Password reset tokens. |
| `events_legacy` | Old event data. |
| `podcasts` | Podcasts and YouTube videos. |

---

## Observations

**GEN-007 metadata inspection** (workspace `Social Bees`, branch `flutter-v2-sandbox`, 2026-09-29):
- `neighborhoods.city_id` references `city_graph_cities`. `genie_venues.neighborhood_id` is an integer but has no Xano table-reference metadata; text fields `neighborhood_text` and `area_neighborhood` also exist. The schema does not enforce the venue-to-neighborhood relationship, and application-level mapping remains unverified.
- `genie_events.venue_id` references `genie_venues`; `genie_events_upsert_dev` writes this table and is called by `process_batch_data`. `genie_social_events` has many sandbox API code paths for event feed/detail, RSVP, producer events, and event creation/update. Its `producer_id` references `genie_producer_profiles`; its `venue_id` is an integer without a declared table reference and its neighborhood is text. These endpoints establish implemented paths, not runtime traffic.
- `genie_external_events` stores Ticketmaster, SeatGeek, and Viator items with source-native IDs. `genie_external_event_tags` links these events to `genie_tags`.
- `genie_event_calendar` is a separate significant-event calendar; a seed function inserts World Cup entries, but no reader appeared in the searched Genie API/function/task metadata. `events_legacy` remains present, with no direct references found in that same search. Treat those as no consumers found, not proof that no consumer exists outside the inspected metadata.
- `events_discovery_houston` is active every 7,200 seconds on this sandbox branch. Its endpoint calls Ticketmaster and SeatGeek discovery, then external ingestion with Viator enabled in sandbox mode. Discovery writes to `genie_social_events`; external ingestion writes to `genie_external_events` and records ingestion logs. The task description omits the external-ingestion step.
- `City Graph - Run B Images`, `City Graph - Run B Vibes`, and `City Graph - Process Raw Candidates` are inactive here. Their configured schedules end in February 2026. No active City Graph Master Runner task appeared in this branch's task inventory.
- PredictHQ has no standalone table in the inspected schema. `genie_social_events` has `phq_event_id`, `phq_rank`, `phq_predicted_attendance`, `phq_category`, `phq_labels`, `phq_demand_type`, and `phq_impact_radius_km`. A sandbox enrichment function queries PredictHQ, and the event feed sorts by `phq_rank`. No dedicated scheduled PredictHQ task was found. **User-reported UI check of `flutter-v2-sandbox` (2026-09-29):** `phq_event_id` is empty across the checked records and all `phq_rank` values are 0. Counts were not provided, and population of the other `phq_*` fields was not specified. The MCP record-query tool was not used because it has no branch selector and defaults to live data.
- Findings apply only to `flutter-v2-sandbox`; live `v1` was not inspected or compared.

**Inconsistencies to raise with Al:**
- **Two city "sources of truth":** `genie_cities` and `city_graph_cities` both claim the role.
- **Multiple event stores:** `genie_events`, `genie_external_events`, `genie_social_events`, `genie_event_calendar`, and `events_legacy` have different purposes and code paths. `genie_social_events` has the broadest API usage; `genie_events` has a batch-upsert path; `genie_external_events` has scheduled ingestion. Confirm the intended unified forecasting source and whether calendar/legacy stores have consumers outside the inspected metadata.
- **Three messaging systems:** `genie_message` (Genie chat), `genie_message_threads` / `genie_messages`, and `genie_user_threads`.
- **Several vendor and offer tables:** `Vendor`, `Vendor_0`, `genie_vendor`; `Offers`, `genie_offers`, `vibbee_offers`, `influencer_offers`.

**Open questions for WS-9:**
1. Does application logic populate and validate `genie_venues.neighborhood_id`, given Xano does not declare it as a table reference?
2. How many rows do the behavioral tables (★ in section 5) hold today, and since what date?
3. Do any readers for `genie_event_calendar` or `events_legacy` exist outside the inspected sandbox Genie API/function/task metadata?
4. Are these tables identical on `v1` and `flutter-v2-sandbox`?
