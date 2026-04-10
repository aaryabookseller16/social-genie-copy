# Social Bevy / Genie — Backend API Reference

> **Developer Integration Guide — Phase 1 Houston — April 2026**

---

## Base URLs

| Group | Base URL |
|-------|----------|
| **Genie** | `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e` |
| **Auth (Magic Link)** | `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8` |
| **Stripe Checkout** | `https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY` |

> ⚠️ **IMPORTANT:** There are **three different base URLs**. Auth endpoints use the Magic Link URL. Stripe endpoints use the Stripe URL. All Genie endpoints use the Genie URL. Using the wrong base URL will return **404 errors**.

**Content-Type:** `application/json`  
**Auth required:** None on consumer endpoints (unless noted)  
**Status:** All endpoints published and public

---

## Complete Endpoint Index

| Method | Endpoint | Group | Purpose |
|--------|----------|-------|---------|
| `POST` | `auth/verify_email/signup` | Magic Link | Signup — request magic link email |
| `POST` | `auth/verify_email/magic_login` | Magic Link | Verify token — returns auth token |
| `GET` | `auth/me` | Magic Link | Get current user (requires auth header) |
| `POST` | `genie/guest_session` | Genie | Create anonymous guest session |
| `POST` | `genie/ep_handle_message_dev` | Genie | Main Genie message handler |
| `GET` | `genie/venue` | Genie | Get a specific venue by ID |
| `POST` | `genie/save_venue` | Genie | Save a venue to user list |
| `GET` | `genie/saved_venues` | Genie | Get saved venues for a user |
| `POST` | `genie/convert_guest_session` | Genie | Convert guest session to authenticated user |
| `GET` | `genie/prompt_should_show` | Genie | Check if signup prompt should show |
| `POST` | `genie/prompt_log_event` | Genie | Log a prompt event |
| `POST` | `genie/prompt_dismiss` | Genie | Dismiss a prompt |
| `GET` | `genie/vendor_search` | Genie | Search venues by name and city (autosuggest) |
| `POST` | `genie/vendor_onboarding_start` | Genie | Start vendor onboarding — creates vendor record |
| `POST` | `genie/vendor_onboarding_contact` | Genie | Update vendor contact information |
| `POST` | `genie/vendor_onboarding_plan` | Genie | Set selected plan for vendor |
| `POST` | `genie/vendor_onboarding_manual` | Genie | Manual business add (no City Graph match) |
| `POST` | `genie/vendor_onboarding_complete` | Genie | Complete onboarding — sets vendor live |
| `GET` | `products` | Stripe | Get available Stripe products |
| `POST` | `sessions` | Stripe | Create Stripe checkout session |
| `GET` | `sessions` | Stripe | List checkout sessions |
| `GET` | `sessions/{id}` | Stripe | Get session by ID |
| `GET` | `sessions/{id}/line_items` | Stripe | Get line items for session |
| `POST` | `webhooks` | Stripe | Stripe webhook — do not call from frontend |
| `POST` | `genie/checkout_vendor_plan` | Genie | Create Stripe checkout session for vendor plan or boost |
| `POST` | `genie/checkout_vibee` | Genie | Create Stripe checkout session for V.I.Bee membership |
| `GET` | `genie/vendor_dashboard` | Genie | Full dashboard data for Basic and Pro |
| `GET` | `genie/vendor_analytics_summary` | Genie | Period analytics — Pro tier only |
| `GET` | `genie/vendor_profile_completeness` | Genie | Profile score and missing fields |
| `POST` | `genie/vendor_log_interaction` | Genie | Log user interaction with a venue |

---

## 1. Authentication Endpoints

> **These endpoints use:** `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8`

Genie uses **Magic Link** — no passwords. The flow is:  
**user submits email → receives link → clicks link → token exchanged for auth token**

---

### 1.1 Signup / Request Magic Link

Call when a user submits their email on the Free Account or V.I.Bee signup screens. Sends a magic link email.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/verify_email/signup`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | **Yes** | User email address |
| `redirect_uri` | string | **Yes** | `https://www.socialbevy.com/verified` |
| `first_name` | string | No | For account creation |
| `last_name` | string | No | For account creation |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` if magic link email was sent |
| `message` | string | Confirmation message |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/verify_email/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "redirect_uri": "https://www.socialbevy.com/verified",
    "first_name": "Jane",
    "last_name": "Doe"
  }'
```

---

### 1.2 Verify Magic Link Token

Called on the `/verified` page after the user clicks their email link. Exchange the token for an auth token.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/verify_email/magic_login`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | **Yes** | Token from the magic link URL `?token=` query parameter |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `authToken` | string | Store and send as `Authorization` header on authenticated requests |
| `user` | object | User object: `id`, `email`, `first_name`, `last_name` |
| `is_new_user` | boolean | `true` if this is a new account |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/verify_email/magic_login" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_MAGIC_LINK_TOKEN"
  }'
```

> 📝 **The `/verified` page** on socialbevy.com needs to be built. On load: extract token from URL query params → POST to verify endpoint → store `authToken` → redirect to home.

---

### 1.3 Get Current User

Returns the authenticated user record. Requires `Authorization` header.

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/me`

> 🔒 **Private endpoint — requires `Authorization: Bearer {authToken}` header.**

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | User ID |
| `email` | string | Email address |
| `first_name` | string | First name |
| `last_name` | string | Last name |

**cURL Example**

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/me" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## 2. Genie Consumer Endpoints

> **All endpoints below use:** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e`

---

### 2.1 Create Guest Session

Call on app launch for unauthenticated users. Store `session_token` and `external_user_id` — pass both on every subsequent call.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/guest_session`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | string | **Yes** | `"web"` or `"mobile"` |
| `context` | object | No | Optional metadata e.g. `{ "source": "web" }` |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `session_token` | string | Store and pass on all `handle_message` calls |
| `external_user_id` | string | Pass as `external_user_id` on all `handle_message` calls |
| `session_id` | integer | Internal session ID |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/guest_session" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "web",
    "context": { "source": "web" }
  }'
```

---

### 2.2 Handle Message (Main Genie Endpoint)

Primary entry point for all Genie queries.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/ep_handle_message_dev`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | **Yes** | User query e.g. `"brunch in Houston"` |
| `channel` | string | **Yes** | `"web"` or `"mobile"` |
| `external_user_id` | string | **Yes** | From `guest_session` response |
| `city_context` | string | No | e.g. `"Houston"` |
| `session_token` | string | No | Pass back on every call |
| `lat` | decimal | No | User latitude for near-me queries |
| `lng` | decimal | No | User longitude for near-me queries |
| `radius_meters` | integer | No | Defaults to `2500` |
| `location_label` | string | No | e.g. `"Downtown Houston"` |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `reply` | string | Genie response text — display above venue cards |
| `reply_mode` | string | `has_results` \| `supported_no_results` \| `city_missing` \| `city_unsupported` \| `ai_fallback` |
| `use_xano` | boolean | `true` = DB results, `false` = AI fallback |
| `venues` | array | Venue objects. First 3 = Decision screen. Rest = More Nearby |
| `needs_location` | boolean | `true` = near-me requested but no coordinates sent |
| `filters` | object | Detected intent e.g. `{ type: "brunch" }` |
| `session_id` | integer | Session ID |
| `session_token` | string | Always use the latest token returned |
| `profile_prompt` | string | Email nudge — display if non-null |
| `error` | object | `null` on success |

**`reply_mode` Routing**

| Value | Behavior |
|-------|----------|
| `has_results` | Show venue cards. `use_xano = true` |
| `supported_no_results` | City supported but no DB matches — show `reply` text only |
| `city_missing` | Ask user for city — show `reply` as prompt |
| `city_unsupported` | City not in DB — show AI reply only |
| `ai_fallback` | AI generated — show reply only |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/ep_handle_message_dev" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "brunch in Houston",
    "channel": "web",
    "external_user_id": "guest_abc123",
    "city_context": "Houston",
    "session_token": "YOUR_SESSION_TOKEN"
  }'
```

**cURL Example (with location)**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/ep_handle_message_dev" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "coffee near me",
    "channel": "mobile",
    "external_user_id": "guest_abc123",
    "session_token": "YOUR_SESSION_TOKEN",
    "lat": 29.7604,
    "lng": -95.3698,
    "radius_meters": 2500,
    "location_label": "Downtown Houston"
  }'
```

---

### 2.3 Get Venue by ID

Fetch a single venue by its ID. Use to hydrate the Vendor Detail screen if needed.

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/venue`

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | **Yes** | Venue ID |

**cURL Example**

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/venue?id=413"
```

---

### 2.4 Save Venue

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/save_venue`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `external_user_id` | string | **Yes** | User identifier |
| `venue_id` | integer | **Yes** | Venue ID |
| `session_token` | string | No | Session token |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` if saved |
| `saved_venue_id` | integer | Saved record ID |
| `prompt_signup` | boolean | `true` if signup prompt should show |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/save_venue" \
  -H "Content-Type: application/json" \
  -d '{
    "external_user_id": "guest_abc123",
    "venue_id": 413,
    "session_token": "YOUR_SESSION_TOKEN"
  }'
```

---

### 2.5 Get Saved Venues

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/saved_venues`

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `external_user_id` | string | **Yes** | User identifier |
| `session_token` | string | No | Session token |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `venues` | array | Saved venue objects |
| `count` | integer | Total count |

**cURL Example**

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/saved_venues?external_user_id=guest_abc123&session_token=YOUR_SESSION_TOKEN"
```

---

### 2.6 Convert Guest Session

Call after a guest signs up or logs in to link their session history to their new account.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/convert_guest_session`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_token` | string | **Yes** | Existing guest session token |
| `external_user_id` | string | **Yes** | New authenticated user ID |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/convert_guest_session" \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "GUEST_SESSION_TOKEN",
    "external_user_id": "auth_user_456"
  }'
```

---

## 3. Signup Prompt Endpoints

These endpoints power the behavior-triggered signup prompt system. Signup prompts appear **after value is delivered** — not on first launch.

---

### 3.1 Should Show Prompt

Check whether to show a signup prompt based on the user's session history and dismissal count.

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/prompt_should_show`

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `external_user_id` | string | **Yes** | User identifier |
| `session_token` | string | No | Session token |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `should_show` | boolean | `true` if prompt should be shown |
| `prompt_type` | string | Type of prompt to show |
| `reason` | string | Why prompt is being shown |

**cURL Example**

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/prompt_should_show?external_user_id=guest_abc123&session_token=YOUR_SESSION_TOKEN"
```

---

### 3.2 Log Prompt Event

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/prompt_log_event`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `external_user_id` | string | **Yes** | User identifier |
| `session_token` | string | **Yes** | Session token |
| `event_type` | string | **Yes** | `"shown"` \| `"tapped"` \| `"dismissed"` |
| `prompt_type` | string | **Yes** | The prompt type being logged |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/prompt_log_event" \
  -H "Content-Type: application/json" \
  -d '{
    "external_user_id": "guest_abc123",
    "session_token": "YOUR_SESSION_TOKEN",
    "event_type": "shown",
    "prompt_type": "signup_nudge"
  }'
```

---

### 3.3 Dismiss Prompt

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/prompt_dismiss`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `external_user_id` | string | **Yes** | User identifier |
| `session_token` | string | **Yes** | Session token |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/prompt_dismiss" \
  -H "Content-Type: application/json" \
  -d '{
    "external_user_id": "guest_abc123",
    "session_token": "YOUR_SESSION_TOKEN"
  }'
```

---

## 4. Vendor Onboarding Endpoints

Vendor onboarding is a **multi-step flow**. Call endpoints in this order:  
**start → contact → plan → complete**  
Use `manual` for unmatched businesses.

> ⚠️ **Vendor onboarding is a MULTI-STEP flow** — not a single endpoint. Each screen in the vendor registration flow calls a different endpoint.

---

### 4.1 Search Venues (Autosuggest)

Powers the "Claim Your Business" search. Call while the vendor types.

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_search`

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | **Yes** | Business name search text |
| `city` | string | No | Defaults to Houston |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `results` | array | Matched venues: `id`, `venue_name`, `address`, `city`, `area_neighborhood` |
| `count` | integer | Result count |

**cURL Example**

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_search?query=sample+bistro&city=Houston"
```

---

### 4.2 Start Onboarding

Call when vendor confirms their business match (screen V-04) or begins manual add. Creates the vendor and onboarding records.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_start`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `venue_id` | integer | No | Matched venue ID from search (claim path) |
| `business_name` | string | No | Business name (manual path) |
| `email` | string | **Yes** | Vendor contact email |
| `first_name` | string | **Yes** | Contact first name |
| `last_name` | string | **Yes** | Contact last name |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `vendor_id` | integer | **Store this** — required for all subsequent onboarding calls |
| `onboarding_id` | integer | Onboarding record ID |
| `success` | boolean | `true` if created |

**cURL Example (Claim path)**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_start" \
  -H "Content-Type: application/json" \
  -d '{
    "venue_id": 413,
    "email": "owner@samplebistro.com",
    "first_name": "John",
    "last_name": "Smith"
  }'
```

**cURL Example (Manual path)**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_start" \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "Sample Bistro",
    "email": "owner@samplebistro.com",
    "first_name": "John",
    "last_name": "Smith"
  }'
```

---

### 4.3 Update Contact Info

Call on screen V-05 Contact Info submission.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_contact`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | integer | **Yes** | From start response |
| `first_name` | string | **Yes** | Contact first name |
| `last_name` | string | **Yes** | Contact last name |
| `email` | string | **Yes** | Contact email |
| `phone` | string | No | Contact phone |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_contact" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 101,
    "first_name": "John",
    "last_name": "Smith",
    "email": "owner@samplebistro.com",
    "phone": "713-555-0100"
  }'
```

---

### 4.4 Set Plan

Call on screen V-07 "Choose Your Plan." Stores the selected plan — **does not process payment**.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_plan`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | integer | **Yes** | From start response |
| `plan` | string | **Yes** | `"founding_partner"` \| `"boost_tier_1"` \| `"boost_tier_2"` \| `"boost_tier_3"` |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` if plan stored |
| `checkout_required` | boolean | `true` if payment needed |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_plan" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 101,
    "plan": "founding_partner"
  }'
```

---

### 4.5 Manual Business Add

Call on screen V-09 "Manual Add Business" for vendors not matched in City Graph.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_manual`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | integer | **Yes** | From start response |
| `business_name` | string | **Yes** | Business name |
| `business_address` | string | **Yes** | Street address |
| `city` | string | **Yes** | City |
| `state` | string | No | State |
| `zip` | string | No | Zip code |
| `phone` | string | No | Business phone |
| `email` | string | No | Business email |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_manual" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 101,
    "business_name": "Sample Bistro",
    "business_address": "123 Main St",
    "city": "Houston",
    "state": "TX",
    "zip": "77002",
    "phone": "713-555-0100",
    "email": "info@samplebistro.com"
  }'
```

---

### 4.6 Complete Onboarding

Call after payment is confirmed (or for free plan). Sets vendor status to live.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_complete`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | integer | **Yes** | From start response |
| `location_enabled` | boolean | No | Whether vendor enabled location |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` if vendor is now live |
| `vendor_id` | integer | Vendor ID |
| `is_live` | boolean | `true` if listing is active in Genie |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_complete" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 101,
    "location_enabled": true
  }'
```

---

## 5. Checkout Endpoints

> **Checkout endpoints use the Genie base URL:** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e`

---

### 5.1 Vendor Plan Checkout

Creates a Stripe checkout session for a vendor plan or boost purchase. Redirect vendor to the returned `checkout_url`.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/checkout_vendor_plan`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | integer | **Yes** | Vendor ID |
| `plan_type` | string | **Yes** | `"founding_partner"` for monthly subscription |
| `boost_tier` | string | No | `"1999"` \| `"3999"` \| `"5999"` for one-time boost tiers |
| `email` | string | **Yes** | Customer email for Stripe |
| `success_url` | string | **Yes** | Redirect on payment success |
| `cancel_url` | string | **Yes** | Redirect if payment cancelled |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `checkout_url` | string | Redirect vendor to this URL |
| `session_id` | string | Stripe session ID |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/checkout_vendor_plan" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 101,
    "plan_type": "founding_partner",
    "email": "owner@samplebistro.com",
    "success_url": "https://www.socialbevy.com/vendor/dashboard?success=true",
    "cancel_url": "https://www.socialbevy.com/vendor/onboarding?cancelled=true"
  }'
```

---

### 5.2 V.I.Bee Checkout

Creates a Stripe checkout session for a V.I.Bee consumer membership.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/checkout_vibee`

**Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | **Yes** | Customer email |
| `external_user_id` | string | **Yes** | User identifier |
| `success_url` | string | **Yes** | Redirect on payment success |
| `cancel_url` | string | **Yes** | Redirect if cancelled |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `checkout_url` | string | Redirect user to this URL |
| `session_id` | string | Stripe session ID |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/checkout_vibee" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "external_user_id": "guest_abc123",
    "success_url": "https://www.socialbevy.com/vibee/success",
    "cancel_url": "https://www.socialbevy.com/vibee/cancel"
  }'
```

---

### 5.3 Native Stripe Endpoints

> **Base URL for all endpoints below:** `https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY`

**Get Products**

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY/products`

Returns available Stripe products/plans.

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY/products"
```

**Create Checkout Session**

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY/sessions`

Creates a Stripe checkout session directly.

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY/sessions" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**List Checkout Sessions**

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY/sessions`

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY/sessions"
```

**Get Session by ID**

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY/sessions/{id}`

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY/sessions/cs_live_abc123"
```

**Get Session Line Items**

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY/sessions/{id}/line_items`

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY/sessions/cs_live_abc123/line_items"
```

**Stripe Webhook**

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:jQf3GatY/webhooks`

> 🚫 Webhook endpoint for Stripe checkout events. Xano handles this automatically — **do not call directly from the frontend.**

---

## 6. Vendor Dashboard Endpoints

> ⚠️ **DISPLAY RULE:** Show `"Pro"` in UI. Store `"founding_partner"` in DB. Never show `"founding_partner"` as a label. Only use `"Founding Partner"` in email confirmations.

> **`vendor_id` vs `venue_id`:** All dashboard endpoints take `vendor_id` — NOT `venue_id`. The backend resolves `venue_id` internally.

---

### 6.1 Main Dashboard

Call on dashboard load. Returns all data for Basic and Pro in a single request.

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_dashboard`

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | integer | **Yes** | Vendor ID — NOT venue_id |

**cURL Example**

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_dashboard?vendor_id=101"
```

**Example Response Shape**

```json
{
  "vendor": {
    "id": 1,
    "business_name": "Sample Bistro",
    "plan_selected": "founding_partner",
    "plan_tier": "pro",
    "is_live": true,
    "is_claimed": true
  },
  "venue": {
    "venue_name": "Sample Bistro",
    "address": "123 Main St, Houston TX",
    "phone": "713-555-0100",
    "website_url": "https://samplebistro.com",
    "reservation_url": "https://resy.com/samplebistro",
    "reservation_platform": "resy",
    "cuisine_tags": ["american", "brunch"],
    "google_maps_url": "https://maps.google.com/?q=...",
    "google_rating": 4.5,
    "area_neighborhood": "Midtown"
  },
  "metrics": {
    "genie_appearances": 312,
    "profile_views": 45,
    "call_clicks": 5,
    "map_clicks": 7,
    "reservation_clicks": 6,
    "saves": 3,
    "total_actions": 21,
    "engagement_rate": 0.067
  },
  "trends": [ "...30 days of daily records for chart..." ],
  "profile_completeness": {
    "score": 85,
    "missing_fields": []
  },
  "first_appearance_at": 1775000000000,
  "last_appearance_at": 1775251737211
}
```

> 📝 **Tip:** Multiply `engagement_rate` × 100 to display as a percentage (e.g. `0.067` → `6.7%`).

**Metrics Visibility by Tier**

| Metric | Basic | Pro |
|--------|-------|-----|
| `genie_appearances` | ✅ | ✅ |
| `profile_views` | ✅ | ✅ |
| `total_actions` | ✅ | ✅ |
| `call_clicks` | ❌ Hide | ✅ |
| `map_clicks` | ❌ Hide | ✅ |
| `reservation_clicks` | ❌ Hide | ✅ |
| `saves` | ❌ Hide | ✅ |
| `engagement_rate` | ❌ Hide | ✅ |
| `trends` chart | ❌ Hide | ✅ |
| `last_appearance_at` | ❌ Hide | ✅ |
| Upgrade to Pro prompt | Always show | ❌ Hide |
| PRO badge | ❌ Hide | ✅ |

> ⚠️ **IMPORTANT:** The backend returns ALL metrics for ALL vendors. The **frontend must hide Pro metrics from Basic vendors**. Do not rely on the backend to filter by tier.

---

### 6.2 Analytics Summary

Period-based analytics. **Pro tier only** — do not show on Basic dashboard.

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_analytics_summary`

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | integer | **Yes** | Vendor ID |
| `period` | string | **Yes** | `"7_days"` \| `"30_days"` \| `"all_time"` |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `period` | string | Period covered |
| `totals` | object | All metric totals for the period |
| `daily_records` | array | Daily breakdown for charting |

**cURL Example**

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_analytics_summary?vendor_id=101&period=30_days"
```

---

### 6.3 Profile Completeness

Available on both Basic and Pro dashboards.

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_profile_completeness`

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | integer | **Yes** | Vendor ID |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `score` | integer | 0–100 |
| `status` | string | `"strong"` (80–100) \| `"good"` (50–79) \| `"needs_work"` (0–49) |
| `required_missing` | array | High urgency missing fields |
| `recommended_missing` | array | Suggested fields to improve discoverability |
| `completed_fields` | array | Fields that are complete |

**cURL Example**

```bash
curl -X GET "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_profile_completeness?vendor_id=101"
```

---

### 6.4 Log Interaction

> 🚨 **CRITICAL:** Call this on every tracked interaction below. Without it, the vendor dashboard shows **zero data**. Fire **asynchronously** — never block the user.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_log_interaction`

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `venue_id` | integer | **Yes** | Venue ID |
| `interaction_type` | string | **Yes** | See interaction types below |
| `user_id` | integer | **Yes** | User ID — use `0` for guests |
| `session_id` | integer | **Yes** | Session ID |

**Interaction Types — When to Fire**

| `interaction_type` | When to Fire | Screen |
|--------------------|-------------|--------|
| `"profile_view"` | Vendor Detail screen opens | U-06 |
| `"call_click"` | User taps Call button | U-06 |
| `"map_click"` | User taps Map / Directions button | U-06 |
| `"reservation_click"` | User taps Reservations button | U-06 |
| `"share"` | User taps Share button | U-06 |

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `logged` | boolean | `true` if recorded |
| `interaction_type` | string | Echo of type sent |
| `venue_id` | integer | Echo of `venue_id` sent |

**cURL Example**

```bash
curl -X POST "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_log_interaction" \
  -H "Content-Type: application/json" \
  -d '{
    "venue_id": 413,
    "interaction_type": "call_click",
    "user_id": 0,
    "session_id": 1
  }'
```

---

## 7. Integration Notes

### 7.1 Session Flow

1. Call `genie/guest_session` on app launch — store `session_token` and `external_user_id`
2. Pass both on every `ep_handle_message_dev` call
3. Always use the **latest** `session_token` returned in each response
4. After user signs up, call `genie/convert_guest_session` to link session to their account

### 7.2 Vendor Detail CTA Logic

| Button | Visibility | Behavior |
|--------|------------|----------|
| **Call** | Conditional — show only if `phone` is non-empty | Fire `"call_click"` |
| **Reservations** | Conditional — show only if `reservation_url` is non-empty | Fire `"reservation_click"` |
| **Directions** | Always | Use `google_maps_url`. Fire `"map_click"` |
| **Share** | Always | Share name + address + maps URL. Fire `"share"` |
| **Save** | Always (icon) | Triggers signup prompt if not authenticated |

### 7.3 Common Mistakes

| Mistake | Severity | Fix |
|---------|----------|-----|
| Wrong base URL for auth | 🔴 High | Auth endpoints use `api:dRDS80y8` — NOT the Genie URL |
| Hitting base URL only | 🔴 High | Must include full path e.g. `/genie/ep_handle_message_dev` |
| Wrong HTTP method | 🔴 High | Check GET vs POST for each endpoint — they differ |
| Missing `channel` | 🔴 High | `ep_handle_message_dev` requires `channel: "web"` or `"mobile"` |
| Missing `external_user_id` | 🔴 High | Get from `guest_session` first — required on all Genie calls |
| Using `venue_id` on dashboard calls | 🔴 High | Dashboard endpoints take `vendor_id` — backend resolves `venue_id` |
| Deriving tier from `plan_selected` | 🔴 High | Always use `plan_tier` from response — never derive from `plan_selected` |
| Not calling `log_interaction` | 🔴 High | All vendor dashboard metrics will be zero without these calls |
| Blocking UI on `log_interaction` | 🟡 Medium | Fire async in background — never `await` before proceeding |
| Skipping `session_token` | 🟡 Medium | Without it, each call starts a new session — no conversation context |

---

*Social Bevy / Genie — Backend API Reference v5 — Phase 1 Houston — April 2026*
