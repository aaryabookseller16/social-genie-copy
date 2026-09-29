# ADR-0004: OneSignal for web push, custom service worker for PWA

- **Status:** Accepted (documents existing design)
- **Date:** 2026-09-23

## Context
Re-engagement ("your weekly picks", offer reminders) needs push on iOS/Android home-screen installs
without building a native app.

## Decision
- The PWA uses `public/site.webmanifest` + `public/sw.js`, registered by `components/shared/PwaBoot.tsx`.
- Push uses **OneSignal** (`react-onesignal`), initialized in `components/shared/NotificationsBoot.tsx`
  with `public/OneSignalSDKWorker.js`. The player/subscription ID is sent to Xano via
  `/api/genie/register-push-token`. Sends are triggered from Xano (`genie/send_notification`).

## Consequences
- ✅ Push without native apps; Xano owns targeting.
- ⚠️ Two service workers (ours + OneSignal) must not collide on scope.
- ⚠️ The OneSignal `appId` is hard-coded, so dev and prod share one app. Move it to an env var.
- ⚠️ iOS web push works only for installed PWAs (iOS 16.4+).
