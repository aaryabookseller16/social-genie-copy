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

## 🧪 Capstone status: Predictive Genie (as of Oct 15, 2026)
The capstone's Genie AI work runs on the Xano branch `flutter-v2-sandbox-tamu-capstone`, not in production, until the sponsor approves it. Plan: [docs/genie_plan.md](docs/genie_plan.md). Change record: [xano/CHANGELOG.md](xano/CHANGELOG.md).

**Working on the capstone branch**
- **Model-picked venues:** on venue searches with results, gpt-4o chooses the best 3 from the ranked shortlist and writes a one-line reason for each. If the model fails, Genie falls back to the ranked list. Replies follow the user's language.
- **User context storage (GEN-010):** one versioned preference document per user or guest device, with stated and inferred sources, removal tombstones, size caps, and compact rendering for the prompt. See [docs/architecture/base_genie_improvements.md](docs/architecture/base_genie_improvements.md#2-user-context-files).
- **Migration (GEN-011):** existing social-profile tags were copied into user contexts on Oct 12 (551 of 551 tags).
- **Quick-pick onboarding (GEN-012):** skippable cards in Genie's greeting save the picks as stated preferences.
- **Tests and CI:** Vitest unit tests; GitHub Actions runs lint, typecheck, tests and build on every pull request.

**Written but not live yet**
- **Chat reads the user context (GEN-013):** preferences used as a tiebreaker when Genie picks venues. The code is on a branch not yet merged to `main`, and waits on the owner's decision about which account table to use (`User` or `genie_user`).
- **Duplicate-pick fixes (Oct 15):** a venue the model picks twice appears only once, and picked venues no longer repeat in "more nearby". These are in the repo but not yet deployed to Xano.

**Not built yet**
- Genie updating a user's context from chat (decided Oct 13; design not yet merged to `main`)
- Preferences inferred from behavior, decay and expiry, deletion and retention, a consent flow for sensitive tags, and a preference editing UI
- Follow-up handling (conversation state), the system prompt rewrite, and a multi-step tool loop
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
