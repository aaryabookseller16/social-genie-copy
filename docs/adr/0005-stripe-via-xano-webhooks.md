# ADR-0005: Stripe checkout and webhooks handled by Xano

- **Status:** Accepted (documents existing design)
- **Date:** 2026-09-23

## Context
Two paid products exist: the **V.I.Bee** consumer membership and **vendor plans**. Membership state
must live next to the user record, which is in Xano.

## Decision
- The app requests a checkout URL through `/api/subscription/create`, which calls Xano
  `genie/checkout_vibee` or `genie/checkout_vendor_plan`. Xano creates the Stripe session.
- Stripe webhooks go **directly to Xano**. The Next.js routes `api/stripe/webhook`,
  `api/stripe/vendor-webhook` and `api/subscription/webhook` are **501 stubs** kept only to document
  that.
- Return pages (`/vibee/success`, `/vendor/success`) poll `/api/subscription/status` (Xano `auth/me`).

## Consequences
- ✅ No Stripe secret key in this repo or on Vercel.
- ✅ A single source of truth for membership status.
- ⚠️ The success page can briefly show "pending" until the webhook lands. Polling covers this.
- 🔁 If the stubs cause confusion, delete them and point to this ADR.
