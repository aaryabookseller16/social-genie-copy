# Contributing

## Workflow
1. Branch from `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
2. Keep PRs focused. Run `npm run build && npm run lint` before pushing.
3. Open a PR. Vercel posts a preview URL, so smoke-test it on a phone.
4. Merge into `main`, which deploys to production.

## Where things go
| You're adding… | Put it in |
|---|---|
| A new backend call | `app/api/<area>/<name>/route.ts` (see [LLD §5](docs/architecture/LLD.md#5-route-handler-pattern)) **and** a typed function in `app/lib/publicApiClient.ts` |
| Server-only helpers | `app/lib/server/`. Never import these from a `"use client"` file |
| Shared types / mappers | `app/lib/genieTypes.ts`, `app/lib/genieMappers.ts` |
| A UI piece used in 2+ places | `app/components/shared/` |
| A screen section of the main app | `app/components/single-page/` |
| A shareable/SEO page | a new route folder under `app/` (server component) |
| Static images | `public/icons/` for icons, otherwise `public/`. Use kebab-case names without spaces |
| Docs | `docs/`. See [docs/README.md](docs/README.md) |

## Rules of thumb
- Browser code never calls Xano directly; go through `/api/*` ([ADR-0001](docs/adr/0001-xano-backend-behind-nextjs-proxy.md)).
- New localStorage keys use the `genie_<name>_v1` format.
- No secrets in `NEXT_PUBLIC_*` variables or in committed files. Add new env vars to `.env.example`
  and `docs/guides/environment-variables.md`.
- If you delete an asset or a module, grep for its name first.
