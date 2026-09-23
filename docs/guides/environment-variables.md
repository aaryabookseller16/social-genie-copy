# Environment variables

Copy [`/.env.example`](../../.env.example) to `.env.local`. `NEXT_PUBLIC_*` variables are inlined into the
browser bundle at build time, so never put secrets in them.

| Variable | Side | Required | Default | Used in |
|---|---|---|---|---|
| `XANO_BASE_URL` | server | no | `https://xwpg-kuah-brlj.n7d.xano.io` | `lib/server/xanoProxy.ts` (origin for the three bases below) |
| `XANO_GENIE_DEV_BASE` | server | no | `${XANO_BASE_URL}/api:pgMKWi2e` | `xanoFetch` |
| `XANO_AUTH_BASE` | server | no | `${XANO_BASE_URL}/api:dRDS80y8` | `xanoAuthFetch` |
| `XANO_STRIPE_BASE` | server | no | `${XANO_BASE_URL}/api:jQf3GatY` | `xanoStripeFetch` |
| `XANO_GENIE_VENUES_URL` | server | no | `…/api:mY7zYhwk/genie_v1` | `lib/server/xanoCatalog.ts` |
| `NEXT_PUBLIC_APP_BASE_URL` | both | no | `https://genie.socialbevy.com` | `api/subscription/create` (Stripe return URLs) |
| `APP_BASE_URL` | server | no | (fallback for the above) | `api/subscription/create` |
| `JWT_SECRET` | server | **yes*** | none, throws | `lib/server/authToken.ts` via `api/genie/message` |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | client | no | map preview hidden | `components/SinglePageGenieApp.tsx` |

\* Only when a request carries a Bearer token, which covers every logged-in chat. This is a legacy path;
see [LLD §7 #1](../architecture/LLD.md#7-known-issues--tech-debt).

**Not configurable yet:** the OneSignal `appId` (`components/shared/NotificationsBoot.tsx`) and the admin
route's Xano URL (`api/admin/city-intelligence/route.ts`) are hard-coded.

**Removed Sept 2026:** `OPENAI_API_KEY`, `NEXT_PUBLIC_XANO_BASE_URL`,
`NEXT_PUBLIC_ENABLE_CLIENT_STATIC_MAPS`. Only dead modules read them. The Genie LLM runs inside Xano.
