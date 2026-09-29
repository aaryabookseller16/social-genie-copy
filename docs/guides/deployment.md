# Deployment

## Genie app → Vercel
- **Project root:** repository root (`/`). Don't change it; `apps/website` is a separate app.
- **Framework preset:** Next.js. Build `npm run build`, output `.next` (defaults).
- **Env vars:** set the ones from [environment-variables.md](environment-variables.md) for
  Production and Preview. At minimum set `JWT_SECRET` and `NEXT_PUBLIC_APP_BASE_URL`
  (for example, `https://genie.socialbevy.com`).
- **Branches:** pushes to `main` deploy to production; every PR gets a preview URL.
- **Domains:** `genie.socialbevy.com` (hard-coded as a fallback in the Stripe return URLs and the OG image URL).

## Marketing website
If it gets deployed, create a **second** Vercel project with Root Directory = `apps/website`.

## External services to update alongside a deploy
| Change | Where |
|---|---|
| New or renamed Xano endpoint | Xano workspace, then the matching `app/api/**/route.ts` |
| Stripe price/plan | Stripe dashboard + Xano `checkout_*` functions |
| Push notification copy/targeting | Xano `send_notification` / OneSignal dashboard |

## Pre-deploy checklist
- [ ] `npm run build` and `npm run lint` pass locally
- [ ] Smoke-tested the Vercel preview URL on mobile (chat, save, login link, checkout)
- [ ] No new `*_dev` Xano endpoints added without a note in `docs/api/`
