# ADR-0001: Xano as backend, reached through Next.js API routes

- **Status:** Accepted (documents existing design)
- **Date:** 2026-09-23

## Context
Social Genie is built by a small team that needs to iterate on data models, LLM prompts and business
logic without running servers. Xano provides a hosted DB + no-code API builder. The browser app still
needs a stable contract that doesn't leak Xano workspace URLs or break when endpoints are renamed
(e.g. `ep_*_dev` → production names).

## Decision
All data and business logic live in **Xano**. The browser calls only same-origin **`/api/*` route
handlers**, which forward to Xano via `xanoFetch` / `xanoAuthFetch` / `xanoStripeFetch`
(`app/lib/server/xanoProxy.ts`). Browser code calls the proxy only through `app/lib/publicApiClient.ts`.
Server-rendered pages may call `xanoFetch` directly.

## Consequences
- ✅ Xano endpoint renames are a one-line change in a route handler.
- ✅ No CORS config; the Bearer token is forwarded, not re-issued.
- ✅ Base URLs are overridable per environment (`XANO_*` env vars).
- ⚠️ An extra network hop on every call (Vercel function → Xano).
- ⚠️ Business logic isn't version-controlled in this repo; Xano changes need to be documented in
  `docs/api/`.
- 🔁 Revisit if latency or Xano limits become the bottleneck.
