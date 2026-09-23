# ADR-0003: A single client-side app shell for the core experience

- **Status:** Accepted, under review (see Consequences)
- **Date:** 2026-09-23

## Context
Genie is conversational: moving between chat, results, venue detail, saved spots and account needs to
feel instant and keep the orb/animation state alive. It also runs as an installed PWA.

## Decision
`/` and `/saved` render one client component, `SinglePageGenieApp`, which switches screens through
`activeScreen: FlowAnchor` state and `?screen=` deep links. Pages that must be shareable or
SEO/OG-friendly (`/venue/[id]`, `/events/[slug]`, `/i/[handle]`) are separate server-rendered routes.

## Consequences
- ✅ App-like transitions; shared state without a global store.
- ⚠️ The shell has grown to ~5.4k lines (`VendorSection` ~2k). It's hard to review and test, and
  everything ships in one client bundle.
- 🔁 **Next step:** keep the shell pattern but split it into per-screen modules under
  `components/screens/<anchor>/`, with shared state in a context or a reducer. Optionally move
  account/vendor into nested routes.
