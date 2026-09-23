# Local development

## Prerequisites
- Node.js 20+ (tested on 24.x) and npm
- Access to the Xano workspace if you need to change backend endpoints

## Run the Genie app
```bash
npm install
cp .env.example .env.local     # then fill in values, see environment-variables.md
npm run dev                    # http://localhost:3000
```
The Xano base URLs default to the production workspace, so the app works with an empty `.env.local`.
Set `JWT_SECRET`, though, or logged-in chat requests will return 500 (see
[LLD §7 #1](../architecture/LLD.md#7-known-issues--tech-debt)).

To test on your phone over Wi-Fi, open the "Network" URL that `next dev` prints.
Push notifications work on `localhost` (`allowLocalhostAsSecureOrigin`), but not over a LAN IP without HTTPS.

## Run the marketing website
```bash
cd apps/website
npm install
npm run dev -- -p 3001
```

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Next dev server (Turbopack) |
| `npm run build` | Production build + type check |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (`apps/` is ignored; lint it from its own folder) |

## Useful local URLs
`/`, `/saved`, `/join`, `/venue/<id>`, `/events/<slug>`, `/i/<handle>`, `/worldcup`,
`/admin/city-intelligence`, `/vibee/success?session_id=…`
