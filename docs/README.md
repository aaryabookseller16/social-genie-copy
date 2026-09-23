# Social Genie documentation

| Section | What's inside |
|---|---|
| [architecture/HLD.md](architecture/HLD.md) | System context, components, key flows |
| [architecture/LLD.md](architecture/LLD.md) | Code layout, module roles, route → Xano map, known issues |
| [adr/](adr/) | Architecture Decision Records. Copy [`0000-template.md`](adr/0000-template.md) for a new one |
| [api/genie-api-reference.md](api/genie-api-reference.md) | Xano API reference v8.0 (35 endpoints, April 2026) |
| [api/endpoint-curl-examples.md](api/endpoint-curl-examples.md) | cURL examples for each endpoint (April 10, 2026) |
| [guides/local-development.md](guides/local-development.md) | Setup, scripts, running both apps |
| [guides/environment-variables.md](guides/environment-variables.md) | Every env var and its default |
| [guides/deployment.md](guides/deployment.md) | Vercel setup and release checklist |
| [reports/](reports/) | Point-in-time audits (not kept up to date) |

## ADR index
| # | Decision | Status |
|---|---|---|
| [0001](adr/0001-xano-backend-behind-nextjs-proxy.md) | Xano backend behind Next.js API proxy | Accepted |
| [0002](adr/0002-passwordless-magic-link-jwt-auth.md) | Passwordless magic-link auth | Accepted |
| [0003](adr/0003-single-page-app-shell.md) | Single client-side app shell | Accepted, under review |
| [0004](adr/0004-onesignal-push-and-pwa.md) | OneSignal push + PWA | Accepted |
| [0005](adr/0005-stripe-via-xano-webhooks.md) | Stripe via Xano | Accepted |

## Conventions
- Architecture changes → update HLD/LLD **in the same PR**.
- A decision that is hard to reverse → add an ADR (next free number; never renumber).
- Audits and one-off reports → `reports/` with a date in the filename.
