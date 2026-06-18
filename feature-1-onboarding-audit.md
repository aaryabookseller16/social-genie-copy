# Feature 1: Onboarding & Accounts — Audit

**Date:** 2026-06-18
**Branch:** `v1.5-dev/feature-1-onboarding-accounts`
**Status:** ✅ Complete & tested end-to-end

---

## 1. Overview

Universal onboarding wizard that runs on a guest session (no login required) and merges into a real account on magic link click. One account, additive roles.

**Scope delivered:**
- Frontend (React/Next.js) + Next.js proxy routes
- Xano backend endpoints (3 new endpoints published on `v1.5-dev`)
- Magic-link only auth (no password, no OAuth)

---

## 2. The 5-Step Wizard

| Step | Screen | Anchor | Saves to |
|------|--------|--------|----------|
| 1 | Account creation | `account` | Xano: magic link sent |
| 2 | Social preferences | `preferences` | Xano: `genie_user_social_profile` (guest) |
| 3 | Role identifier cards | `role-identifier` | localStorage: `genie_onboarding_roles_v1` |
| 4 | Role setup (conditional) | `role-setup` | localStorage: `genie_onboarding_role_details_v1` |
| 5 | Completion | `onboarding-complete` | localStorage: `genie_onboarding_pending_v1` |

Step 4 is skipped if the user only selects Consumer (default). Steps 3 and 4 data syncs to the server after magic link click.

---

## 3. Files Added / Modified

### New files
| File | Purpose |
|------|---------|
| `app/components/single-page/RoleIdentifierSection.tsx` | Step 3 — 4-card multi-select role picker |
| `app/components/single-page/RoleSetupSection.tsx` | Step 4 — per-role setup fields |
| `app/components/single-page/OnboardingCompleteSection.tsx` | Step 5 — completion screen + pending state write |
| `app/components/single-page/VerifyEmailGate.tsx` | Modal gate for unverified users |
| `app/api/genie/set-user-roles/route.ts` | Proxy → Xano `set_user_roles` |
| `app/api/genie/save-producer-details/route.ts` | Proxy → Xano `save_producer_details` |
| `app/api/genie/save-influencer-details/route.ts` | Proxy → Xano `save_influencer_details` |
| `.env.local` | Points Genie + Auth APIs to `v1.5-dev` branch |

### Modified files
| File | What changed |
|------|-------------|
| `app/components/single-page/ui.tsx` | Added `role-identifier`, `role-setup`, `onboarding-complete` to `FlowAnchor` union |
| `app/lib/localState.ts` | Added `OnboardingRole`, `OnboardingPendingState` types + read/write helpers |
| `app/lib/analyticsEvents.ts` | Added 4 events: `onboardingRolesSelected`, `onboardingRoleSetupContinue`, `onboardingCompleted`, `verifyEmailResendTapped` |
| `app/lib/publicApiClient.ts` | Added `setUserRoles`, `saveProducerDetails`, `saveInfluencerDetails` client functions |
| `app/api/auth/login/route.ts` | Forwards `verified` field from Xano magic_login response |
| `app/components/single-page/AccountSection.tsx` | Added `onAdvanceOnboarding` prop — advances wizard after signup |
| `app/components/SinglePageGenieApp.tsx` | Wizard orchestration, verification gate, post-login sync, deep-link allow-list |

---

## 4. Xano Endpoints (v1.5-dev)

### New endpoints published

#### `POST /set_user_roles`
- **API group:** `api:pgMKWi2e` (Genie Dev)
- **Auth:** None (uses `external_user_id`)
- **Input:** `external_user_id` (text), `roles` (json)
- **What it does:** Finds `genie_user` by `external_user_id`, sets `roles` json column
- **Response:** `{ success: true, roles: [...] }`
- **Tested:** ✅

#### `POST /save_producer_details`
- **API group:** `api:pgMKWi2e` (Genie Dev)
- **Auth:** None (uses `external_user_id`)
- **Input:** `external_user_id` (text), `brand_name` (text, optional), `producer_handle` (text, optional)
- **What it does:** Updates `genie_user.promoter_artist_name`, `promoter_instagram_handle`, `is_promoter: true`
- **Response:** `{ success: true, brand_name: "...", producer_handle: "..." }`
- **Tested:** ✅

#### `POST /save_influencer_details`
- **API group:** `api:pgMKWi2e` (Genie Dev)
- **Auth:** None (uses `external_user_id`)
- **Input:** `external_user_id` (text), `influencer_handle` (text, optional)
- **What it does:** Updates `genie_user.influencer_handle`
- **Response:** `{ success: true, influencer_handle: "..." }`
- **Tested:** ✅

### Existing endpoints modified

#### `POST /auth/verify_email/magic_login` (`api:dRDS80y8`)
- `expiration` changed from `86400` (1 day) → `31536000` (365 days)
- Already returned `verified: true` — no change needed
- **Tested:** ✅

### Database changes

| Table | Column | Type | Default | Purpose |
|-------|--------|------|---------|---------|
| `genie_user` | `roles` | `json` | `[]` | Stores array of selected roles |
| `genie_user` | `influencer_handle` | `text` | `""` | Influencer's social handle |

---

## 5. Environment Configuration

| Variable | Value | Purpose |
|----------|-------|---------|
| `XANO_GENIE_DEV_BASE` | `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e:v1.5-dev` | Points Genie API calls to dev branch |
| `XANO_AUTH_BASE` | `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8:v1.5-dev` | Points Auth API calls to dev branch |

> ⚠️ Before deploying to production, update these to the live branch or remove entirely (defaults in `xanoProxy.ts` point to live).

---

## 6. Data Flow — Guest Session to Verified Account

```
Wizard runs (guest)           Magic link clicked           Account active
──────────────────────        ──────────────────────       ──────────────
social_profile saved    ───►  mergeGuestProfile()    ───►  prefs on account
roles in localStorage   ───►  setUserRoles()         ───►  genie_user.roles
details in localStorage ───►  saveProducerDetails()  ───►  genie_user.promoter_*
                              saveInfluencerDetails() ───►  genie_user.influencer_handle
                              localStorage details cleared
                              writeOnboardingPending(null)
```

---

## 7. Verification Gate

**Trigger:** User completes wizard → `writeOnboardingPending({ email, completedAt, verified: false })`

**Shows when:**
- No `authToken` in localStorage
- No `account` in state
- `readOnboardingPending()` returns a non-null, non-verified state

**Blocks these actions:**
- `handleQuery` — Genie search
- `selectVenue` — venue detail tap
- `handleSaveVenue` — save/heart a venue
- `handleRedeemOffer` — redeem V.I.Bee offer

**Dismissed:** On successful magic link exchange → `writeOnboardingPending(null)`

---

## 8. End-to-End Test Results

**Test run: 2026-06-18**

```
GET /                                200 ✅
POST /api/genie/init-device          200 ✅
POST /api/auth/signup                200 ✅  magic link sent
GET  /api/genie/social-profile       200 ✅  prefs loaded
POST /api/genie/social-profile       200 ✅  prefs saved
--- magic link clicked ---
POST /api/auth/login                 200 ✅  login succeeded
POST /api/genie/merge-guest-profile  200 ✅  guest prefs merged
POST /api/genie/set-user-roles       200 ✅  roles saved
POST /api/genie/save-influencer-details  200 ✅
POST /api/genie/save-producer-details    200 ✅
GET  /api/auth/me                    200 ✅
GET  /api/subscription/status        200 ✅
GET  /api/user/saved-venues          200 ✅
```

---

## 9. Known Issues Fixed During Build

| Issue | Root Cause | Fix Applied |
|-------|-----------|-------------|
| Magic link URL `?/token=` not parsed | Xano sending `?/token=` instead of `?token=` | Code fallback added + Xano URL fixed |
| `social-profile 404` on onboarding | App hitting live branch, new endpoints only on v1.5-dev | `.env.local` created |
| `set-user-roles 404` during wizard | `genie_user` row doesn't exist until magic link click | Deferred sync to post-login handler |
| `roles` column type error | Column was `text`, needed `json` for array storage | Changed to `json` in Xano |

---

## 10. Weaknesses Fixed

| # | Issue | Fix |
|---|-------|-----|
| 1 | Gate only covered query + venue tap | Added to `handleSaveVenue` + `handleRedeemOffer` |
| 3 | Double API fire (fail pre-login + succeed post-login) | `RoleSetupSection` only fires if `readAuthToken()` truthy |
| 4 | Role details never cleared from localStorage after sync | `localStorage.removeItem` after magic link sync |
| 5 | Verified returning user could reset pending state | `OnboardingCompleteSection` guarded by `!readAuthToken()` |
| 6 | Producer/influencer sync ignored role selection | Added `savedRoles.includes("producer/influencer")` guard |

---

## 11. Remaining Open Issues

| # | Issue | Severity | Requires |
|---|-------|----------|---------|
| 2 | Gate bypassed if localStorage cleared (different device) | High | New Xano `check_verification_status` endpoint |
| 7 | `POST /api/genie/session 400` noise on login | Low | Investigate `convertGuestSession` condition |
| 8 | `?/token=` fallback is tech debt | Low | Remove after confirming Xano URL permanently fixed |

---

## 12. Pre-Production Checklist

- [ ] Merge `v1.5-dev` Xano branch to `live`
- [ ] Update or remove `.env.local` for production
- [ ] Confirm magic link URL format on production domain (`?token=` not `?/token=`)
- [ ] Verify `genie_user.roles` and `genie_user.influencer_handle` columns exist on live branch post-merge
- [ ] Run full wizard on mobile browser
- [ ] Test "Skip — just exploring" path (consumer only → completion, no role setup)
- [ ] Test vendor role path (role setup → existing vendor flow)

---

## 13. Out of Scope (Deferred)

| Item | Reason |
|------|--------|
| OAuth (Google / Apple) | Descoped — magic-link only decision |
| Password auth | Descoped |
| Producer profile approval flow | Requires new Xano workflow |
| Influencer verification / follower count | No backend yet |
| Server-side verification gate | Requires new Xano endpoint |
