# ADR-0002: Passwordless magic-link auth issued by Xano

- **Status:** Accepted (documents existing design)
- **Date:** 2026-09-23

## Context
Target users are on phones, often arriving from a social link. Passwords add friction and support
load. Guests must be able to use Genie before signing up, and keep their saves afterwards.

## Decision
- Users start as **guests** (`genie/guest_session`, device ID in localStorage).
- Signup/login is a **magic link** from the Xano Auth group (`auth/verify_email/signup`,
  `auth/verify_email/magic_login`). The email link lands on `/verified?token=…`, which redirects to
  `/?token=…` for the app to exchange.
- The Xano `authToken` is stored in localStorage (`genie_auth_token_v1`) and sent as
  `Authorization: Bearer` on protected calls.
- After login, `genie/convert_guest_session` migrates guest data.

## Consequences
- ✅ One-tap login on mobile; no password storage in our stack.
- ⚠️ Tokens in localStorage are readable by any XSS. Keep third-party scripts minimal.
- ⚠️ A legacy local-JWT path (`lib/server/authToken.ts`, `requestAuth.ts`, `apiStore.ts`) still exists
  and conflicts with this decision. See LLD §7 #1. It should be removed.
