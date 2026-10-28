# 🎩 Social Genie — AI-Powered Social Concierge
*By Social Bevy*

Social Genie helps people get social instantly. Tell Genie the vibe you want ("cute patio",
"R&B brunch", "grown and sexy lounge") and it replies with curated venues and events, conversational
guidance, and spots you can save. V.I.Bee members unlock offers, and venue owners can claim and manage
their listing.

Live: **https://genie.socialbevy.com**

---

## ✨ Features
- **Conversational search**: chat or voice with Genie; the LLM and ranking run in Xano
- **Venues and events**: shareable server-rendered pages at `/venue/[id]` and `/events/[slug]`, plus influencer pages at `/i/[handle]`
- **Saved spots**: for guests (localStorage) and members (synced to Xano)
- **Accounts**: passwordless magic-link login; guest sessions carry over after signup
- **V.I.Bee membership and offers**: Stripe checkout, offer redemption with QR verification
- **Vendor portal**: claim a venue, edit its profile, create offers, view analytics
- **PWA and push**: installable, with web push through OneSignal
- **Mobile-first UI** with light and dark themes

## 🧪 Capstone status: Predictive Genie (as of Oct 21, 2026)
The capstone's Genie AI work runs on the Xano branch `flutter-v2-sandbox-tamu-capstone` and the `tamu_capstone` datasource, not in production, until the sponsor approves it. Plan: [docs/genie_plan.md](docs/genie_plan.md). Change record: [xano/CHANGELOG.md](xano/CHANGELOG.md).

**Working on the capstone branch**
- **Model-picked venues:** on venue searches with results, gpt-4o chooses the best 3 and writes a one-line reason for each, using the six-section system prompt (pick-v2.2). If the model fails, Genie falls back to the ranked list. Replies follow the user's language. A venue the model picks twice appears once, and picked venues do not repeat in "more nearby".
- **Request-first search (GEN-071):** one ranker for every venue request. A small model call reads the message in any language and turns it into a mode and filters (type, cuisine, neighborhood, price, energy, open now, keywords), so English and Spanish requests get the same shortlist. Closed and non-hospitality venues are never shortlisted, a location adds a radius and a distance term, and every shortlisted venue has a logged score breakdown. See [docs/architecture/ranking.md](docs/architecture/ranking.md).
- **User context (GEN-010 to GEN-013):** one versioned preference document per account or guest device, with stated and learned preferences, removal tombstones and size caps. It is filled by quick-pick onboarding, the preferences screen and venue saves, follows the user to their account at sign-in, and is used as a small ranking bonus and a tiebreaker in the pick prompt. See [docs/architecture/user_context.md](docs/architecture/user_context.md).
- **Learning from chat (GEN-014):** after each reply, Genie quietly saves likes and dislikes the user states or reacts with ("not into happy hours", "the first one is too loud"), judged by the model. Dislikes rank matching venues lower and are never mentioned unless asked.
- **Tests and CI:** Vitest unit tests; GitHub Actions runs lint, typecheck, tests and build on every pull request.

**Not built yet**
- Decay and expiry of learned preferences, deletion and retention, a consent flow for sensitive tags, and a preference editing UI
- Follow-up handling (conversation state) and a multi-step tool loop
- Track 2: neighborhood demand forecast and proactive notifications

## 🧱 Stack
| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, next-themes |
| API layer | Next.js route handlers in `app/api/**` that proxy to Xano |
| Backend | Xano (database, business logic, Genie chat) |
| Payments | Stripe, integrated through Xano |
| Push | OneSignal |
| Hosting | Vercel |

Architecture details are in [docs/architecture/HLD.md](docs/architecture/HLD.md) and [LLD.md](docs/architecture/LLD.md).

## 🚀 Quickstart
```bash
npm install
cp .env.example .env.local   # set JWT_SECRET at minimum
npm run dev                  # http://localhost:3000
```
More detail: [docs/guides/local-development.md](docs/guides/local-development.md) ·
[environment variables](docs/guides/environment-variables.md) ·
[deployment](docs/guides/deployment.md) ·
[Claude Code ↔ Xano MCP](docs/guides/xano-mcp.md)

## 📁 Repository layout
```
app/                 Genie Next.js app (pages, api/ proxy routes, components/, lib/)
apps/website/        Social Bevy marketing site (separate Next.js app, early stage)
docs/                HLD, LLD, ADRs, API reference, guides, audit reports
public/              Static assets, service workers, PWA manifest
```

## 📚 Documentation
Start at **[docs/README.md](docs/README.md)**. Highlights:
- [Architecture Decision Records](docs/adr/)
- [Xano API reference](docs/api/genie-api-reference.md)
- [Production-readiness audit (Apr 2026)](docs/reports/production-readiness-2026-04-11.md)
- [Contributing guide](CONTRIBUTING.md)

## 🖼️ Venue image priority
`image_primary_url` → `image_fallback_url` → `image` → `image_url` → placeholder.
Many venues still need valid direct image URLs in Xano.

## 🛠️ Known follow-ups
- Split `app/components/SinglePageGenieApp.tsx` (about 5.4k lines) and `VendorSection.tsx` (about 2k lines) into per-screen modules ([ADR-0003](docs/adr/0003-single-page-app-shell.md))
- Remove the legacy local-JWT check in `/api/genie/message` ([LLD §7](docs/architecture/LLD.md#7-known-issues--tech-debt))
- Add authentication to `/api/admin/city-intelligence`
- Expand tests: unit tests exist for mappers, config, city extraction, catalog search and quick picks; there are no component or end-to-end tests
- Rename assets in `public/` whose names contain spaces or `(1)`
- Move remaining `*_dev` Xano endpoints to production names

## 📬 Contact
**Alphonso Roundtree**, Founder & CEO, Social Bevy; Social Genie Team Lead
