# Genie / Social Bevy — V1 API Documentation
> Developer-ready working draft · Prepared for the Genie / Social Bevy V1 build

---

## Table of Contents

1. [Base Configuration](#1-base-configuration)
2. [Authentication](#2-authentication)
3. [Endpoint Summary](#3-endpoint-summary)
4. [Genie Core — Send Message](#4-genie-core--send-message)
5. [Auth — Sign Up](#5-auth--sign-up)
6. [Auth — Login](#6-auth--login)
7. [Auth — Get Current User](#7-auth--get-current-user)
8. [User — Save Venue](#8-user--save-venue)
9. [User — Unsave Venue](#9-user--unsave-venue)
10. [User — Get Saved Venues](#10-user--get-saved-venues)
11. [Subscription — Create (V.I.Bee)](#11-subscription--create-vibee)
12. [Subscription — Get Status](#12-subscription--get-status)
13. [Vendor — Search Business](#13-vendor--search-business)
14. [Vendor — Claim Business](#14-vendor--claim-business)
15. [Vendor — Add Business (Manual)](#15-vendor--add-business-manual)
16. [Vendor — Dashboard Summary](#16-vendor--dashboard-summary)
17. [Vendor — Update Profile](#17-vendor--update-profile)
18. [Analytics — Track Event](#18-analytics--track-event)
19. [Standard Data Objects](#19-standard-data-objects)
20. [HTTP Status Codes](#20-http-status-codes)
21. [Third-Party Services](#21-third-party-services)
22. [Implementation Rules](#22-implementation-rules)
23. [Open Items (Pending Confirmation)](#23-open-items-pending-confirmation)

---

## 1. Base Configuration

| Field | Value |
|-------|-------|
| **Status** | Working draft — updated with V1 public API architecture and final Xano wrapper naming |
| **Public Base URL (Production)** | `https://genie.socialbevy.com/api` |
| **Local Development Base URL** | `http://localhost:3000/api` |
| **Auth Method** | JWT via Bearer Token |
| **Authorization Header** | `Authorization: Bearer <token>` |
| **Maps** | Google Maps / Google Static Maps |
| **AI Usage** | Fallback responses only (backend) — frontend must never call OpenAI directly |

### Architecture Overview

```
Client (PWA)
    ↓
Public Next.js API Layer  →  https://genie.socialbevy.com/api
    ↓
Xano Internal Backend  →  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/
    ↓
City Graph (structured data) → AI fallback (only when structured data is insufficient)
```

> **Internal Xano upstream wrapper (reference only):**
> `POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/ep_handle_message_dev`
>
> The `_dev` suffix is an **intentional and permanent** internal wrapper name. It does not indicate the public API is in development mode. Frontend clients must never call this Xano endpoint directly — always use the public Next.js API layer.

### Core Architecture Rule

> **Xano-first:** Query structured City Graph data first. Return structured results whenever possible. Only fall back to AI when City Graph data does not support the request. Do not default to AI-generated venue results.

---

## 2. Authentication

All protected endpoints require a JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are returned from `POST /auth/signup` and `POST /auth/login`. Token expiration, refresh strategy, and logout/invalidation behavior are pending confirmation — see [Open Items](#23-open-items-pending-confirmation).

| Auth Required | Meaning |
|---------------|---------|
| **No** | Endpoint is publicly accessible without a token |
| **Optional** | Anonymous sessions supported; JWT accepted if provided for enriched responses |
| **Yes** | Valid JWT required; `401` returned if missing or invalid |

---

## 3. Endpoint Summary

| Area | Method | Endpoint | Auth | Purpose |
|------|--------|----------|------|---------|
| Genie Core | `POST` | `/genie/message` | Optional | Send a message to Genie; returns reply + venue results |
| Auth | `POST` | `/auth/signup` | No | Create account, return JWT |
| Auth | `POST` | `/auth/login` | No | Authenticate existing user, return JWT |
| Auth | `GET` | `/auth/me` | Yes | Return current authenticated user |
| User | `POST` | `/user/save-venue` | Yes | Save a venue to user profile |
| User | `POST` | `/user/unsave-venue` | Yes | Remove a saved venue |
| User | `GET` | `/user/saved-venues` | Yes | List all saved venues |
| Subscription | `POST` | `/subscription/create` | Yes | Start V.I.Bee Stripe checkout |
| Subscription | `GET` | `/subscription/status` | Yes | Get current subscription status |
| Vendor | `GET` | `/vendor/search` | Yes | Search City Graph for a business listing |
| Vendor | `POST` | `/vendor/claim` | Yes | Claim an existing business |
| Vendor | `POST` | `/vendor/create` | Yes | Manually add a new business |
| Vendor | `GET` | `/vendor/dashboard` | Yes | Return vendor dashboard metrics |
| Vendor | `PUT` | `/vendor/profile` | Yes | Update vendor profile fields |
| Analytics | `POST` | `/analytics/track` | Yes | Track frontend/product events |

---

## 4. Genie Core — Send Message

> **This is the primary endpoint.** All discovery queries flow through here.

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/genie/message` |
| **Auth Required** | Optional (anonymous session supported; JWT accepted for signed-in users) |
| **Description** | Processes user input (voice transcript or typed query) and returns a Genie reply, the decisive 3 venue results, nearby alternatives, and the active session token. Public route sits in front of the internal Xano wrapper endpoint. |

### Request Body

```json
{
  "message": "Find me a brunch spot near me",
  "channel": "web",
  "external_user_id": "optional-external-id",
  "user_name": "Alphonso",
  "city_context": "Houston",
  "session_token": "optional-session-token",
  "user": {
    "first_name": "Alphonso",
    "user_id": "optional"
  },
  "user_data": {
    "first_name": "Alphonso"
  },
  "meta": {
    "source": "home"
  },
  "debug": false,
  "entry_point": "home",
  "entry_context_id": null,
  "location": {
    "lat": 29.7604,
    "lng": -95.3698
  },
  "radius_meters": 8047,
  "location_label": "Midtown"
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | The user's natural language query |
| `channel` | string | Yes | Always `"web"` for the PWA |
| `city_context` | string | Yes | City name — `"Houston"` for Phase 1 |
| `session_token` | string | Optional | Guest session token for continuity |
| `external_user_id` | string | Optional | Caller's own user ID if applicable |
| `user_name` | string | Optional | User's first name for personalization |
| `user.first_name` | string | Optional | User's first name (nested form) |
| `user.user_id` | string | Optional | Signed-in user ID |
| `user_data` | object | Optional | Additional user context |
| `meta.source` | string | Optional | Screen source (e.g. `"home"`, `"chip"`) |
| `debug` | boolean | Optional | Set `false` in production |
| `entry_point` | string | Optional | Entry surface identifier |
| `entry_context_id` | string/null | Optional | Context entity ID if applicable |
| `location.lat` | number | Optional | User latitude |
| `location.lng` | number | Optional | User longitude |
| `radius_meters` | number | Optional | Search radius in meters (default `8047` = ~5 mi) |
| `location_label` | string | Optional | Human-readable location label (e.g. `"Midtown"`) |

### Response

```json
{
  "reply": "Here are a few spots with a strong vibe near you.",
  "decisive": [
    {
      "id": 123,
      "venue_name": "The Breakfast Klub",
      "area_neighborhood": "Midtown",
      "distance_miles": 1.2,
      "vibe_notes": "Busy, energetic brunch spot",
      "image_primary_url": "https://...",
      "address": "3711 Travis St, Houston, TX",
      "google_maps_url": "https://...",
      "phone": "713-000-0000",
      "reservation_url": null,
      "is_open_now": true
    }
  ],
  "more_nearby": [
    {
      "id": 456,
      "venue_name": "Another Spot",
      "image_primary_url": "https://..."
    }
  ],
  "session_token": "abc123"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `reply` | string | Genie's natural language intro for the result set |
| `decisive` | array | Max **3** venue objects — the primary recommendations |
| `more_nearby` | array | 8–12 additional venue objects for the More Nearby screen |
| `session_token` | string | Session token to carry into subsequent requests |

### Important Notes

- `decisive` array is always capped at **3 venues maximum**
- `more_nearby` is recommended to be capped at **8–12 results**
- Backend must query City Graph / Xano first and only fall back to AI when structured retrieval does not support the request
- The public Next.js route maps the nested `location` object into flat `lat`, `lng`, `radius_meters`, `location_label` fields before sending to the internal Xano upstream wrapper
- `session_token` returned in the response should be stored and sent in subsequent requests for session continuity

### Internal Xano Upstream Wrapper (Reference Only)

> Not for direct frontend use. Documented here for backend implementation reference.

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/genie/ep_handle_message_dev` |
| **Auth Required** | Not required on the current internal wrapper |
| **Purpose** | HTTP wrapper that calls `fn_genie_handle_message_dev` |

Internal request body shape (flat, not nested):

```json
{
  "message": "string",
  "channel": "string",
  "external_user_id": "string",
  "user_name": "string",
  "city_context": "string",
  "session_token": "string",
  "user_data": {},
  "meta": {},
  "debug": false,
  "entry_point": "string",
  "entry_context_id": "string",
  "lat": 0,
  "lng": 0,
  "radius_meters": 0,
  "location_label": "string"
}
```

---

## 5. Auth — Sign Up

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/auth/signup` |
| **Auth Required** | No |
| **Description** | Creates a new user account and returns a JWT plus the created user record. |

### Request Body

```json
{
  "first_name": "Alphonso",
  "last_name": "Roundtree",
  "email": "user@email.com",
  "phone": "optional",
  "password": "securepassword"
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `first_name` | string | Yes | User's first name |
| `last_name` | string | Yes | User's last name |
| `email` | string | Yes | Must be unique; used as login identifier |
| `phone` | string | Optional | For updates and confirmations |
| `password` | string | Yes | Secure password |

### Response

```json
{
  "token": "jwt_token",
  "user": {
    "id": 1,
    "first_name": "Alphonso"
  }
}
```

### Notes

- Store the returned `token` in `sessionStore` — include in all subsequent authenticated requests
- Pass the `session_token` from the Genie session in the request body so Xano can merge guest activity into the new user account (see plan.md guest session merging)
- Email uniqueness validation is handled server-side; surface a "Log In" prompt to the user on duplicate email errors

---

## 6. Auth — Login

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/auth/login` |
| **Auth Required** | No |
| **Description** | Authenticates an existing user and returns a valid JWT plus user information. |

### Request Body

```json
{
  "email": "user@email.com",
  "password": "securepassword"
}
```

### Response

```json
{
  "token": "jwt_token",
  "user": {
    "id": 1,
    "first_name": "Alphonso"
  }
}
```

---

## 7. Auth — Get Current User

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/auth/me` |
| **Auth Required** | Yes |
| **Description** | Returns the currently authenticated user profile. Used to verify token validity and hydrate session on app load. |

### Response

```json
{
  "user": {
    "id": 1,
    "first_name": "Alphonso"
  }
}
```

### Notes

- Call this on app load when a token exists in `sessionStore` to confirm the session is still valid
- If this returns `401`, clear the stored token and treat the user as a guest

---

## 8. User — Save Venue

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/user/save-venue` |
| **Auth Required** | Yes |
| **Description** | Saves a venue to the authenticated user's profile. |

### Request Body

```json
{
  "venue_id": 123
}
```

### Response

```json
{
  "success": true
}
```

### Notes

- If user is anonymous when they tap Save, trigger the signup prompt (see U-06 behavior in plan.md)
- Only call this endpoint after the user is authenticated

---

## 9. User — Unsave Venue

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/user/unsave-venue` |
| **Auth Required** | Yes |
| **Description** | Removes a venue from the authenticated user's saved list. |

### Request Body

```json
{
  "venue_id": 123
}
```

### Response

```json
{
  "success": true
}
```

---

## 10. User — Get Saved Venues

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/user/saved-venues` |
| **Auth Required** | Yes |
| **Description** | Returns the authenticated user's complete saved venue list. |

### Response

```json
{
  "venues": [
    {
      "id": 123,
      "venue_name": "Example Venue"
    }
  ]
}
```

### Notes

- Pagination and sorting rules for saved venues are pending confirmation — see [Open Items](#23-open-items-pending-confirmation)
- Each venue in the array should match the standard [Venue Object](#venue-object) shape

---

## 11. Subscription — Create (V.I.Bee)

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/subscription/create` |
| **Auth Required** | Yes |
| **Description** | Creates a Stripe checkout session for the V.I.Bee membership and returns a checkout URL to redirect the user to. |

### Response

```json
{
  "checkout_url": "https://stripe.com/..."
}
```

### Frontend Integration

```typescript
// 1. Call endpoint to get checkout URL
const { checkout_url } = await api.post('/subscription/create');

// 2. Redirect user to Stripe hosted checkout
window.location.href = checkout_url;

// 3. On Stripe success: Stripe redirects back with ?session_id=
//    Call GET /subscription/status to confirm membership is active
//    Frontend NEVER determines membership state locally
```

### Notes

- Stripe products, price IDs, renewal rules, cancellation behavior, and webhook events are pending confirmation — see [Open Items](#23-open-items-pending-confirmation)
- Frontend must never calculate or assume membership status — always confirm via `GET /subscription/status`
- On Stripe cancel: return user to `/account-intro` without error state

---

## 12. Subscription — Get Status

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/subscription/status` |
| **Auth Required** | Yes |
| **Description** | Returns the current V.I.Bee subscription status for the authenticated user. |

### Response

```json
{
  "status": "active"
}
```

### Status Values

| Value | Meaning |
|-------|---------|
| `active` | User has a paid, active V.I.Bee membership |
| `inactive` | No active membership |
| `cancelled` | Previously subscribed, now cancelled |
| `past_due` | Payment failed; access may be restricted |

> ⚠️ Exact status values pending Stripe integration confirmation.

---

## 13. Vendor — Search Business

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/vendor/search?query=restaurant+name` |
| **Auth Required** | Yes |
| **Description** | Searches the City Graph for an existing business listing to claim. Used to power the autosuggest on the V-01 Claim Your Business screen. |

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Business name search string |

### Response

```json
{
  "results": [
    {
      "id": 123,
      "venue_name": "Example Venue"
    }
  ]
}
```

### Frontend Usage

```typescript
// Debounce this call — fire after 300ms of inactivity, minimum 2 characters
const results = await api.get('/vendor/search', { params: { query: searchText } });
```

### Notes

- Results should be ranked by City Graph confidence score
- Favors known City Graph businesses first
- Used for both the live autosuggest dropdown (V-01) and the full search submit that leads to V-02 Finding Your Business

---

## 14. Vendor — Claim Business

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/vendor/claim` |
| **Auth Required** | Yes |
| **Description** | Creates a business claim record linking the authenticated vendor to an existing City Graph venue. |

### Request Body

```json
{
  "venue_id": 123,
  "contact_name": "Owner Name",
  "email": "owner@email.com",
  "phone": "optional"
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `venue_id` | integer | Yes | ID of the City Graph venue being claimed |
| `contact_name` | string | Yes | Owner or representative full name |
| `email` | string | Yes | Contact email for the vendor account |
| `phone` | string | Optional | Contact phone number |

### Response

```json
{
  "success": true,
  "claim_status": "submitted"
}
```

### Claim Status Values

| Value | Meaning |
|-------|---------|
| `submitted` | Claim received and pending review |
| `approved` | Claim approved; vendor is live |
| `rejected` | Claim rejected |

---

## 15. Vendor — Add Business (Manual)

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/vendor/create` |
| **Auth Required** | Yes |
| **Description** | Creates a new vendor listing manually when no City Graph match exists. Used when the vendor reaches V-09 Manual Add Business. |

### Request Body

> Full request body fields pending — the following is derived from the V-09 screen form fields in the FRD.

```json
{
  "business_name": "Sunset Grill",
  "full_name": "First Last",
  "email": "owner@email.com",
  "phone": "optional",
  "address": "2945 Westheimer Rd",
  "city_state_zip": "Houston, TX 77088",
  "is_manual_entry": true
}
```

### Response

```json
{
  "success": true,
  "vendor_id": 789
}
```

### Notes

- Address normalization and geocoding are handled on the backend — do not attempt client-side
- Whether `/vendor/create` requires moderation or approval before public visibility is pending confirmation — see [Open Items](#23-open-items-pending-confirmation)
- If moderation applies, surface messaging to the vendor that their listing is under review

---

## 16. Vendor — Dashboard Summary

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/vendor/dashboard` |
| **Auth Required** | Yes |
| **Description** | Returns top-level V1 dashboard metrics for the authenticated vendor. |

### Response

```json
{
  "views": 1200,
  "clicks": 320,
  "saves": 85,
  "genie_appearances": 540
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `views` | integer | Total profile/listing views |
| `clicks` | integer | Total CTA clicks (call, reservations, share) |
| `saves` | integer | Total times venue was saved by consumers |
| `genie_appearances` | integer | Times venue appeared in Genie result sets |

### Notes

- Exact metric definitions (what counts as a view, click, appearance, or save) are pending confirmation — see [Open Items](#23-open-items-pending-confirmation)
- Pagination rules for dashboard data if applicable are also pending

---

## 17. Vendor — Update Profile

| | |
|---|---|
| **Method** | `PUT` |
| **Endpoint** | `/vendor/profile` |
| **Auth Required** | Yes |
| **Description** | Updates vendor profile fields such as business description, hours, contact details, links, and media. |

### Request Body

> Exact editable fields pending confirmation — see [Open Items](#23-open-items-pending-confirmation).

```json
{
  "description": "An upscale poolside nightclub...",
  "phone": "713-000-0000",
  "website_url": "https://...",
  "reservation_url": "https://...",
  "hours": "Open Until 2 AM",
  "image_primary_url": "https://..."
}
```

### Response

```json
{
  "success": true
}
```

---

## 18. Analytics — Track Event

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/analytics/track` |
| **Auth Required** | Yes |
| **Description** | Tracks product analytics and user interaction events from the client application. Fire-and-forget — never await this in the UI path. |

### Request Body

```json
{
  "event": "venue_click",
  "user_id": 1,
  "venue_id": 123,
  "metadata": {
    "source": "decisive_screen"
  }
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | string | Yes | Event name (see required events below) |
| `user_id` | integer | Optional | Authenticated user ID if signed in |
| `venue_id` | integer | Optional | Relevant venue ID if applicable |
| `metadata` | object | Optional | Additional context (source screen, etc.) |

### Response

```json
{
  "success": true
}
```

### Required Analytics Events

| Event | Trigger |
|-------|---------|
| `search_submitted` | User submits a Genie query (voice or text) |
| `result_impression` | Genie returns a result set or a venue card becomes visible |
| `venue_click` | User opens a venue detail screen |
| `map_open` | User opens native maps / Google Maps from venue detail |
| `call_click` | User taps the Call CTA |
| `reserve_click` | User taps the Reservations CTA |
| `save_click` | User saves a venue |
| `signup_prompt_shown` | Signup prompt becomes visible to the user |
| `signup_dismissed` | User dismisses the signup prompt |
| `signup_completed` | User completes account creation |

### Additional Events (from plan.md)

The following events are defined in plan.md and should also be sent to `/analytics/track`:

```
home_screen_viewed         quick_chip_tapped           voice_orb_tapped
typed_query_started        typed_query_submitted        voice_listening_started
voice_listening_cancelled  voice_transcript_captured    voice_permission_denied
genie_query_submitted      genie_query_processing_started  normalized_intent_received
processing_error           genie_results_returned       genie_result_impression
decision_card_tapped       see_more_nearby_tapped       signup_prompt_triggered
more_nearby_opened         more_nearby_card_impression  more_nearby_card_tapped
vendor_detail_opened       vendor_call_tap              vendor_reservation_tap
vendor_map_tap             vendor_share_tap             venue_saved
free_account_cta_tapped    vibee_cta_tapped             vendor_signup_cta_tapped
signup_started             free_signup_submitted        free_signup_completed
signup_validation_error    vibee_signup_started         vibee_checkout_started
vibee_checkout_completed   vibee_checkout_cancelled     vendor_claim_started
vendor_business_search_typed  vendor_business_suggestion_shown  vendor_business_suggestion_selected
vendor_business_search_started  vendor_business_search_completed  vendor_business_search_no_match
vendor_no_match_screen_viewed  vendor_add_business_cta_tapped  vendor_business_match_viewed
vendor_business_confirmed  vendor_business_rejected     vendor_contact_info_started
vendor_contact_info_completed  vendor_contact_info_validation_error  vendor_location_prompt_viewed
vendor_location_enabled    vendor_location_skipped      vendor_location_denied
vendor_plan_screen_viewed  vendor_plan_selected         vendor_boost_selected
vendor_registration_completed  vendor_success_continue_tapped  vendor_manual_add_started
vendor_manual_add_submitted  vendor_manual_add_completed  vendor_manual_add_validation_error
```

### Frontend Implementation

```typescript
// analytics.ts — fire and forget, never block UI
export const track = (event: string, properties?: Record<string, unknown>) => {
  const sessionId = localStorage.getItem('genie_session_id');
  api.post('/analytics/track', {
    event,
    metadata: { ...properties, session_id: sessionId }
  }).catch(() => {}); // swallow errors silently
};
```

---

## 19. Standard Data Objects

### Venue Object

The canonical venue shape returned by `GET /genie/message` and used across Decision, More Nearby, and Venue Detail screens.

```json
{
  "id": 123,
  "venue_name": "Example Venue",
  "area_neighborhood": "Midtown",
  "address": "123 Main St",
  "latitude": "29.76",
  "longitude": "-95.36",
  "vibe_notes": "High energy",
  "price_band": "$$",
  "image_primary_url": "https://...",
  "google_maps_url": "https://...",
  "phone": "713-000-0000",
  "reservation_url": "https://...",
  "reservation_platform": "OpenTable",
  "is_open_now": true
}
```

### Venue Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique venue identifier |
| `venue_name` | string | Display name of the venue |
| `area_neighborhood` | string | Neighborhood label (e.g. "Midtown") |
| `address` | string | Full street address |
| `latitude` | string | Venue latitude coordinate |
| `longitude` | string | Venue longitude coordinate |
| `vibe_notes` | string | Short vibe descriptor shown on cards (e.g. "Busy, energetic brunch spot") |
| `price_band` | string | Price indicator: `$`, `$$`, `$$$`, `$$$$` |
| `image_primary_url` | string | Primary venue image URL |
| `google_maps_url` | string | Deep link to Google Maps for this venue |
| `phone` | string/null | Contact phone number |
| `reservation_url` | string/null | Reservation deep link; `null` if not available — hide Reservations CTA when null |
| `reservation_platform` | string/null | Reservation platform name (e.g. "OpenTable") |
| `is_open_now` | boolean | Whether the venue is currently open |

### Frontend Type Mapping

The API uses `venue_name` and `area_neighborhood` — map these to the `VenueObject` TypeScript interface in the frontend:

```typescript
// api/genie.ts — map API response to frontend VenueObject
const mapVenue = (v: ApiVenue): VenueObject => ({
  id: String(v.id),
  name: v.venue_name,
  neighborhood: v.area_neighborhood,
  address: v.address,
  coordinates: { lat: parseFloat(v.latitude), lng: parseFloat(v.longitude) },
  images: [v.image_primary_url].filter(Boolean),
  vibeSummary: v.vibe_notes,
  openStatus: v.is_open_now ? 'open' : 'closed',
  phone: v.phone ?? undefined,
  reservationsUrl: v.reservation_url ?? undefined,
  // ... map remaining fields
});
```

---

## 20. HTTP Status Codes

| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `200` | Success | Process response normally |
| `400` | Input error / bad request | Surface validation message to user |
| `401` | Unauthorized — missing or invalid token | Clear token, treat user as guest, prompt login |
| `403` | Access denied — insufficient privileges | Show permission error, do not retry |
| `404` | Resource not found | Show not-found state |
| `429` | Rate limited — too many requests | Backoff and retry after delay |
| `500` | Unexpected server error | Show generic error, allow retry |

---

## 21. Third-Party Services

| Service | Used For | Notes |
|---------|----------|-------|
| **Google Maps** | Map links and static map previews in venue detail | Used for routing and place visualization |
| **OpenAI** | Fallback responses only (backend) | Frontend must **never** call OpenAI directly |
| **Stripe** | V.I.Bee subscription checkout | Products, price IDs, webhooks pending confirmation |
| **Reservations (V1)** | Deep links only | Stored as `reservation_url` + `reservation_platform` on the venue object |

---

## 22. Implementation Rules

### Backend Rules

- **Xano-first:** Always query structured City Graph data first; never default to AI-generated venue results
- **No duplicates:** Never return the same venue more than once in a single result set
- **Structured results preferred:** Always return structured data when City Graph or verified vendor data supports the query
- **AI fallback:** Only invoke AI when structured retrieval cannot support the request

### Frontend Rules

- **Never call OpenAI directly** — all AI interaction is backend-only via the Genie endpoint
- **Never call the Xano wrapper directly** — always use the public Next.js API layer at `https://genie.socialbevy.com/api`
- **Always use `/genie/message`** for decision responses — do not implement client-side venue ranking
- **Always respect the documented response structure** — do not re-rank or filter the `decisive` array client-side
- **Never calculate membership status locally** — always confirm via `GET /subscription/status`
- **Analytics are fire-and-forget** — never `await` analytics calls in the UI path
- **Hide Reservations CTA when `reservation_url` is null** — never render a disabled reservations button

---

## 23. Open Items (Pending Confirmation)

The following must be confirmed before engineering handoff and final API sign-off:

| # | Item | Affects |
|---|------|---------|
| 1 | Staging base URL — is there a separate staging environment? | All endpoints |
| 2 | JWT token expiration duration | Auth flow |
| 3 | JWT refresh token strategy — is there a refresh endpoint? | Auth flow |
| 4 | JWT logout / token invalidation behavior and endpoint | Auth flow |
| 5 | Standard error response schema — exact JSON shape for 400, 401, 404, 500 | All endpoints |
| 6 | Anonymous Genie session support — which fields in `/genie/message` are truly required vs optional for unauthenticated users | `/genie/message` |
| 7 | Rate limits, throttling rules, and abuse prevention | All endpoints |
| 8 | Pagination and sorting rules for `/user/saved-venues` | User endpoints |
| 9 | Pagination rules for `/vendor/search` results | Vendor search |
| 10 | Pagination rules for `/vendor/dashboard` metrics | Vendor dashboard |
| 11 | Vendor dashboard metric definitions — what exactly counts as a view, click, appearance, or save | `/vendor/dashboard` |
| 12 | Vendor profile fields editable in V1 — complete list for `PUT /vendor/profile` | Vendor profile |
| 13 | Stripe products and price IDs for V.I.Bee | `/subscription/create` |
| 14 | Stripe renewal rules, cancellation behavior, and webhook events | Subscription flow |
| 15 | Whether `/vendor/create` requires moderation or approval before public listing visibility | `/vendor/create` |
| 16 | Reservation deep-link rules — is `reservation_platform` required in every venue object? | Venue object |
| 17 | Analytics payload requirements — are event timestamp, `session_token`, device info, or user anonymity flags mandatory? | `/analytics/track` |
| 18 | Whether the public `/genie/message` contract is the canonical frontend contract long-term, or if clients will ever call the Xano wrapper shape directly | Architecture |

> **Note:** The internal Xano wrapper intentionally retains the `_dev` suffix in its endpoint path. No production path rename is planned. This is confirmed and final.

---

*End of API Documentation — Genie / Social Bevy V1 · Working Draft*
*This document should be updated with confirmed implementation details before engineering sign-off.*
