---
name: FRD Screen-by-Screen Mini Plan
overview: "Root-app only implementation plan for FRD Phase 1. One screen per sprint, in order, with one matching image reference per screen. Ignore social-bevy-website/ entirely."
todos:
  - id: sprint-0-foundation
    content: "Sprint 0: Shared contracts, response modes, analytics enum, config helpers, and orchestrator refactor"
    status: pending
  - id: sprint-1-u01
    content: "Sprint 1: U-01 Home / Ask Genie"
    status: pending
  - id: sprint-2-u02
    content: "Sprint 2: U-02 Listening"
    status: pending
  - id: sprint-3-u03
    content: "Sprint 3: U-03 Thinking"
    status: pending
  - id: sprint-4-u04
    content: "Sprint 4: U-04 Decision"
    status: pending
  - id: sprint-5-u05
    content: "Sprint 5: U-05 More Nearby"
    status: pending
  - id: sprint-6-u06
    content: "Sprint 6: U-06 Vendor Detail"
    status: pending
  - id: sprint-7-u07
    content: "Sprint 7: U-07 Account Intro"
    status: pending
  - id: sprint-8-u08
    content: "Sprint 8: U-08 Free Account"
    status: pending
  - id: sprint-9-u09
    content: "Sprint 9: U-09 V.I.Bee Signup"
    status: pending
  - id: sprint-10-v01
    content: "Sprint 10: V-01 Claim Your Business"
    status: pending
  - id: sprint-11-v02
    content: "Sprint 11: V-02 Finding Your Business"
    status: pending
  - id: sprint-12-v03
    content: "Sprint 12: V-03 Business Not Found / Add My Business"
    status: pending
  - id: sprint-13-v04
    content: "Sprint 13: V-04 Business Match Confirmation"
    status: pending
  - id: sprint-14-v05
    content: "Sprint 14: V-05 Vendor Contact Info"
    status: pending
  - id: sprint-15-v06
    content: "Sprint 15: V-06 Enable Location"
    status: pending
  - id: sprint-16-v07
    content: "Sprint 16: V-07 Choose Your Plan"
    status: pending
  - id: sprint-17-v08
    content: "Sprint 17: V-08 Vendor Success"
    status: pending
  - id: sprint-18-v09
    content: "Sprint 18: V-09 Manual Add Business"
    status: pending
  - id: sprint-19-hardening
    content: "Sprint 19: Analytics, runtime config, acceptance checklist, tests, and final FRD validation"
    status: pending
isProject: false
---

# FRD Screen-by-Screen Mini Plan

## Scope

- Source of truth: `FRD .pdf`, `.cursor/frd_extract.txt`, and the `images/` folder.
- Scope: repository-root Next.js app only.
- Do not work in `social-bevy-website/`.
- Build in exact screen order: U-01 through U-09, then V-01 through V-09.
- One sprint equals one screen, except Sprint 0 for shared foundation and Sprint 19 for hardening.
- Keep Genie-first and Xano-first behavior.
- Preserve the FRD rules: decisive three, more-nearby from the same answer set, behavior-triggered signup, backend-driven CTA availability, and configurable vendor plans.
- Use the matching image in `images/` as the visual reference for each screen sprint.

## Delivery Rules

- Do not group multiple screens into one sprint.
- Do not start the next screen until the current screen is implemented and reviewed.
- Use the current root app as the baseline:
  - `app/page.tsx`
  - `app/lib/genieClient.ts`
  - `app/api/genie-chat/route.ts`
  - `app/venue/[id]/page.tsx`
  - `app/lib/analytics.ts`
- Keep shared logic reusable so each later sprint is small and isolated.
- If a later screen is referenced by an earlier screen, wire the navigation target only after the destination sprint is complete.
- Each screen sprint must explicitly carry the matching image filename as the UI reference.

## Sprint Map

| Sprint | Screen | Image | Outcome |
| --- | --- | --- | --- |
| Sprint 0 | Foundation | N/A | Shared contracts, response modes, analytics enum, config helpers, and page orchestrator refactor |
| Sprint 1 | U-01 | `images/U-01.png` | Home / Ask Genie |
| Sprint 2 | U-02 | `images/U-02.png` | Listening |
| Sprint 3 | U-03 | `images/U-03.png` | Thinking |
| Sprint 4 | U-04 | `images/U-04.png` | Decision |
| Sprint 5 | U-05 | `images/U-05.png` | More Nearby |
| Sprint 6 | U-06 | `images/U-06.png` | Vendor Detail |
| Sprint 7 | U-07 | `images/U-07.png` | Account Intro |
| Sprint 8 | U-08 | `images/U-08.png` | Free Account |
| Sprint 9 | U-09 | `images/U-09.png` | V.I.Bee Signup |
| Sprint 10 | V-01 | `images/V-01.png` | Claim Your Business |
| Sprint 11 | V-02 | `images/V-02.png` | Finding Your Business |
| Sprint 12 | V-03 | `images/V-03.png` | Business Not Found / Add My Business |
| Sprint 13 | V-04 | `images/V-04.png` | Business Match Confirmation |
| Sprint 14 | V-05 | `images/V-05.png` | Vendor Contact Info |
| Sprint 15 | V-06 | `images/V-06.png` | Enable Location |
| Sprint 16 | V-07 | `images/V-07.png` | Choose Your Plan |
| Sprint 17 | V-08 | `images/V-08.png` | Vendor Success |
| Sprint 18 | V-09 | `images/V-09.png` | Manual Add Business |
| Sprint 19 | Hardening | N/A | Analytics, runtime config, tests, and acceptance validation |

---

## Sprint 0 - Foundation

Goal:
- Establish the shared data contract and app structure before any screen work.

Build:
- Define a shared Genie response envelope with explicit modes:
  - `structured_results`
  - `supported_no_results`
  - `city_unsupported`
  - `ai_fallback`
- Define a stable venue type for Decision, More Nearby, and Vendor Detail.
- Add mapper utilities so UI code does not parse raw API responses directly.
- Refactor `app/lib/genieClient.ts` to use the shared contract.
- Update `app/api/genie-chat/route.ts` to return the normalized mode and structured fields.
- Add reusable config helpers for prompt thresholds, plan pricing, and benefit copy.
- Add an analytics event enum for all FRD events.
- Create component folders for discovery, shared UI, account, and vendor screens.
- Refactor `app/page.tsx` into an orchestrator only, with no screen-specific business logic left inside it.

Files:
- `app/lib/genieTypes.ts`
- `app/lib/genieMappers.ts`
- `app/lib/runtimeConfig.ts`
- `app/lib/signupPrompt.ts`
- `app/lib/vendorOnboarding.ts`
- `app/lib/analyticsEvents.ts`
- `app/lib/genieClient.ts`
- `app/api/genie-chat/route.ts`
- `app/page.tsx`
- `app/components/discovery/`
- `app/components/shared/`
- `app/components/account/`
- `app/components/vendor/`

Exit criteria:
- The app has one contract for Genie responses.
- The app has one venue shape for result-driven screens.
- The page orchestrator is ready for screen-by-screen wiring.

---

## Sprint 1 - U-01 Home / Ask Genie

Goal:
- Build the entry screen where the user starts a query in one tap or one text submit.

Build:
- Use `images/U-01.png` as the visual reference.
- Add the Genie hero and centered visual identity.
- Add quick chips for common intents like Happy Hour, Brunch, and Dinner.
- Add the voice orb for microphone entry.
- Add the text field with the `Ask Genie...` placeholder.
- Add the bottom navigation placeholder state from the FRD mock.
- Pass session and city context into the query payload.
- Keep signup completely out of the way on first use.

Files:
- `app/components/discovery/HomeScreen.tsx`
- `app/components/shared/QuickChips.tsx`
- `app/components/shared/GenieOrb.tsx`
- `app/components/shared/BottomNav.tsx`
- `app/page.tsx`

Exit criteria:
- The user can start a query from Home without signup friction.
- Voice and text entry are both visible and usable.
- Quick chips either prefill or submit a structured starter query.

---

## Sprint 2 - U-02 Listening

Goal:
- Show a clear listening state while voice capture is active.

Build:
- Use `images/U-02.png` as the visual reference.
- Add the listening orb and animated capture state.
- Show the `I'm listening...` message.
- Keep the screen minimal and uncluttered.
- Handle microphone permission denial gracefully.
- Return to text input fallback when voice capture cannot continue.
- Support auto-advance or confirm/send behavior after capture ends.

Files:
- `app/components/discovery/ListeningScreen.tsx`
- `app/components/shared/GenieOrb.tsx`
- `app/page.tsx`

Exit criteria:
- The user can tell the app is actively listening.
- Mic denial does not dead-end the flow.
- The screen stays premium and focused.

---

## Sprint 3 - U-03 Thinking

Goal:
- Build the processing state that confirms the request and routes to the correct response mode.

Build:
- Use `images/U-03.png` as the visual reference.
- Show the normalized intent instead of a raw transcript only.
- Add the thinking animation and Genie continuity.
- Call the Genie message pipeline from this screen.
- Route by response mode:
  - structured results -> U-04
  - supported no results -> no-results state
  - city unsupported -> unsupported-city state
  - AI fallback -> fallback reply state
- Keep the screen brief and confidence-building.

Files:
- `app/components/discovery/ThinkingScreen.tsx`
- `app/page.tsx`
- `app/api/genie-chat/route.ts`

Exit criteria:
- The screen clearly shows Genie understood the request.
- The next state is determined by backend mode, not client guessing.
- The user never sees a generic spinner with no meaning.

---

## Sprint 4 - U-04 Decision

Goal:
- Present the decisive three recommendations as the primary answer.

Build:
- Use `images/U-04.png` as the visual reference.
- Show exactly three primary venue cards when enough data exists.
- Include image, venue name, neighborhood or distance, fit note, and lightweight metadata.
- Add the `See More Nearby` CTA.
- Use backend-driven image fallbacks and CTA availability.
- Add behavior-trigger hooks for later signup prompting.

Files:
- `app/components/discovery/DecisionScreen.tsx`
- `app/components/shared/VenueCard.tsx`
- `app/page.tsx`

Exit criteria:
- The screen feels like the best answer, not a list dump.
- The top three recommendations are visually decisive.
- `See More Nearby` continues the same answer set.

---

## Sprint 5 - U-05 More Nearby

Goal:
- Extend the same answer set with secondary recommendations.

Build:
- Use `images/U-05.png` as the visual reference.
- Show the secondary 2 to 4 venues from the same query result set.
- Keep the card shape consistent with Decision.
- Keep the copy framed as a continuation, not a reset.
- Preserve navigation back to Decision and out to Vendor Detail.

Files:
- `app/components/discovery/MoreNearbyScreen.tsx`
- `app/components/shared/VenueCard.tsx`
- `app/page.tsx`

Exit criteria:
- The user sees a natural extension of the same answer.
- The screen does not feel like a new search.
- Secondary cards remain high quality and relevant.

---

## Sprint 6 - U-06 Vendor Detail

Goal:
- Turn the venue detail page into the action hub from the FRD.

Build:
- Use `images/U-06.png` as the visual reference.
- Add the large hero image and fallback chain.
- Add venue name, neighborhood, status, and social proof.
- Add call, reservations, share, save, and map actions.
- Make reservation CTA availability backend-driven.
- Make save behavior aware of signed-in vs guest state.
- Make map opening use coordinates or address fallback.

Files:
- `app/venue/[id]/page.tsx`
- `app/components/venue/VendorDetailActions.tsx`

Exit criteria:
- The user can evaluate and act on a venue without confusion.
- The page does not fabricate reservations or missing data.
- The above-the-fold actions are clear.

---

## Sprint 7 - U-07 Account Intro

Goal:
- Add the behavior-triggered signup choice screen after value has already been delivered.

Build:
- Use `images/U-07.png` as the visual reference.
- Show the three paths:
  - Free Account
  - V.I.Bee
  - Vendor Signup
- Add prompt suppression rules so the screen is not shown too often.
- Preserve guest session context through the choice screen.
- Keep the vendor path separate from consumer auth.

Files:
- `app/account/intro/page.tsx`
- `app/lib/signupPrompt.ts`

Exit criteria:
- The screen appears only after a value event.
- The three paths are clear and distinct.
- Dismissal can be tracked and suppressed.

---

## Sprint 8 - U-08 Free Account

Goal:
- Build the lightweight consumer account form and guest-to-user handoff.

Build:
- Use `images/U-08.png` as the visual reference.
- Add first name, last name, email, and optional phone fields.
- Add consent handling and validation.
- Submit the account creation request through the backend.
- Preserve prior session context, saves, and discovery state.

Files:
- `app/account/free/page.tsx`
- `app/api/account/free/route.ts`

Exit criteria:
- A guest can convert to a user with minimal friction.
- The session survives account creation.
- Validation is clear and fast.

---

## Sprint 9 - U-09 V.I.Bee Signup

Goal:
- Build the paid membership flow and checkout handoff.

Build:
- Use `images/U-09.png` as the visual reference.
- Add the paid membership form and pricing display.
- Pull pricing from config rather than hardcoding it.
- Create the checkout session on submit.
- Handle cancel and success paths without dead ends.
- Use webhook or backend confirmation for completion state.

Files:
- `app/account/vibee/page.tsx`
- `app/api/account/vibee/checkout/route.ts`
- `app/api/account/vibee/webhook/route.ts`

Exit criteria:
- The user understands what they are paying for before checkout.
- Checkout cancellation is graceful.
- Success is confirmed by backend truth, not local state alone.

---

## Sprint 10 - V-01 Claim Your Business

Goal:
- Build the vendor search entry screen with autosuggest.

Build:
- Use `images/V-01.png` as the visual reference.
- Add the business search field.
- Add debounced autosuggest results.
- Bias suggestions toward known City Graph businesses.
- Move a selected result toward match confirmation.

Files:
- `app/vendor/claim/page.tsx`
- `app/api/vendor/search/route.ts`

Exit criteria:
- A vendor can find their business quickly.
- Suggestions appear while typing.
- The screen feels simple and trustworthy.

---

## Sprint 11 - V-02 Finding Your Business

Goal:
- Build the matching/loading state after a vendor submits search text.

Build:
- Use `images/V-02.png` as the visual reference.
- Keep the query visible.
- Show a clear loading indicator for matching.
- Route matched results to confirmation.
- Route no-match results to the fallback screen.

Files:
- `app/vendor/finding/page.tsx`

Exit criteria:
- The vendor knows the app is actively searching.
- The loading state is short and connected to the task.
- No-match flow is ready to proceed cleanly.

---

## Sprint 12 - V-03 Business Not Found / Add My Business

Goal:
- Build the fallback screen for unmatched businesses.

Build:
- Use `images/V-03.png` as the visual reference.
- Show the supportive no-match copy.
- Keep the searched business context visible.
- Add the `Add my business` CTA.
- Allow the user to retry search if needed.
- Send the vendor toward manual onboarding when they choose the fallback.

Files:
- `app/vendor/not-found/page.tsx`

Exit criteria:
- The fallback feels helpful, not like an error.
- The user can continue without getting stuck.
- The next step is obvious.

---

## Sprint 13 - V-04 Business Match Confirmation

Goal:
- Confirm that the matched business is the right one before contact data is collected.

Build:
- Use `images/V-04.png` as the visual reference.
- Show the matched business card prominently.
- Add yes and no confirmation actions.
- Keep the rejection path clean and recoverable.
- Tie the confirmed business record into the vendor flow.

Files:
- `app/vendor/match/page.tsx`

Exit criteria:
- The vendor can confidently verify the match.
- A wrong match does not trap the user.
- The confirmed business carries forward cleanly.

---

## Sprint 14 - V-05 Vendor Contact Info

Goal:
- Collect the owner or representative contact details.

Build:
- Use `images/V-05.png` as the visual reference.
- Add first name, last name, email, and phone fields.
- Add email validation before progression.
- Carry forward the business ID from the matching flow.
- Persist a vendor draft so progress is not lost.

Files:
- `app/vendor/contact/page.tsx`
- `app/lib/vendorOnboarding.ts`

Exit criteria:
- The form is fast to complete on mobile.
- Validation is clear.
- Draft progress survives interruption.

---

## Sprint 15 - V-06 Enable Location

Goal:
- Add the visibility and location permission step.

Build:
- Use `images/V-06.png` as the visual reference.
- Show the minimal explanatory copy and location icon.
- Request location permission or confirm location setup.
- Let deny or skip continue unless product rules later require otherwise.
- Store the visibility setup state on the vendor draft.

Files:
- `app/vendor/location/page.tsx`

Exit criteria:
- The screen is understandable in one glance.
- Skipping does not break the flow.
- The location state is recorded.

---

## Sprint 16 - V-07 Choose Your Plan

Goal:
- Build the vendor monetization screen with config-driven plan cards.

Build:
- Use `images/V-07.png` as the visual reference.
- Show the Founding Partner and Boost Placement options.
- Display plan benefits clearly.
- Separate recurring from one-time pricing.
- Pull pricing and copy from runtime config.
- Store the selected plan even if payment is deferred.

Files:
- `app/vendor/plan/page.tsx`
- `app/lib/runtimeConfig.ts`

Exit criteria:
- The vendor understands what each option does.
- Pricing is not hardcoded.
- The selected plan persists.

---

## Sprint 17 - V-08 Vendor Success

Goal:
- Confirm that the vendor is live and ready to continue.

Build:
- Use `images/V-08.png` as the visual reference.
- Show the success state with a clear confirmation message.
- Require backend confirmation before this screen is shown.
- Add the continue CTA to the best next destination.
- Keep the success state premium and rewarding.

Files:
- `app/vendor/success/page.tsx`

Exit criteria:
- The vendor knows they are live.
- The next step is obvious.
- The screen feels like the end of a successful flow.

---

## Sprint 18 - V-09 Manual Add Business

Goal:
- Build the manual business entry fallback for unmatched vendors.

Build:
- Use `images/V-09.png` as the visual reference.
- Add business name, full name, email, phone, business address, and city/state/zip fields.
- Add validation and normalization for address capture.
- Keep the manual path quick and trustworthy.
- Prepare the record for downstream review or enrichment if needed.

Files:
- `app/vendor/manual-add/page.tsx`
- `app/api/vendor/submit/route.ts`

Exit criteria:
- An unmatched business can still onboard.
- Required fields are obvious.
- The manual path is not a dead end.

---

## Sprint 19 - Hardening

Goal:
- Finish the project with analytics, runtime config, tests, and acceptance validation.

Build:
- Wire all analytics events from the FRD.
- Centralize runtime config for pricing, prompt limits, and copy.
- Add an acceptance checklist for all screens and edge states.
- Add targeted tests for response mapping, signup prompt logic, and vendor draft flow.
- Validate edge cases:
  - fewer than 3 results
  - image fallback
  - unsupported city
  - no-results state
  - signup prompt suppression
  - checkout cancel flow
  - vendor no-match flow

Files:
- `app/lib/analytics.ts`
- `app/lib/analyticsEvents.ts`
- `app/api/config/route.ts`
- `app/lib/runtimeConfig.ts`
- `docs/frd-acceptance-checklist.md`
- `app/lib/__tests__/genieMappers.test.ts`
- `app/lib/__tests__/signupPrompt.test.ts`
- `app/lib/__tests__/vendorOnboarding.test.ts`

Exit criteria:
- Every FRD screen has coverage.
- Shared behavior is consistent across screens.
- The plan is ready for implementation and review.

## Final Notes

- Build in order.
- Finish one screen before starting the next.
- Keep route logic thin and push reusable behavior into shared helpers.
- Do not include `social-bevy-website/` in the implementation path.
- The target is a clean, screen-by-screen execution plan that can be followed without guessing.
