# Features in the pipeline (customer app)

These are planned but have no backend yet. The app shows each one as a **"Coming soon"** state (`src/components/layout/shared/feedback/coming-soon.tsx`): no sample data, no controls. Sidebar entries carry a **Soon** badge (`soon: true` in `src/lib/mypageseo/navigation.ts`).

When the backend ships one of these, replace its Coming-soon page with the real screen and remove it from this list.

| Feature | Where it shows "Coming soon" | Backend status (2026-10-11) | What it needs before we build |
|---|---|---|---|
| **AI Visibility** (do AI assistants recommend the business) | `/ai-visibility` (sidebar: Visibility → AI Visibility, "Soon") | Planned, no spec | Data source and API shape |
| **Automations** (custom rules on ranking/review/profile changes) | `/automations`, `/automations/create`, `/automations/:id` (sidebar: Workspace → Automations, "Soon") | Not built; "don't build" for now | Product spec. Note: monthly refreshes, scheduled reports and GBP auto-posts already run on their own pages |
| **Notifications** (in-app and email alerts) | `/notifications` (header bell) | Phase 15 | Notification list + read state API |
| **Notification settings** | `/settings/notifications` | Phase 15 | Preferences API |
| **Custom domain for share links** (white-label hosting) | Settings → White-Label, "Custom domain" card | Planned, spec pending | Domain verification + DNS flow API |

## Built in the app, waiting on the backend going live

Not "Coming soon": the screens are real and handle the current backend answers.

| Feature | Today | What the app does |
|---|---|---|
| AI (review drafts, post text, images, auto-posts) | No OpenAI key on the server | 503 `ai_not_configured` → AI buttons show the error or are hidden (reviews hide them via `ai.configured`) |
| Publishing posts to Google | First live post pending | Flows work; a failed publish shows `error.message` on the post |
| GBP verification status | Empty | Shows "Not available" |
| PayPal checkout | No prices / no sandbox | 409 `price_not_set` → "Billing opens soon" |
| Real customers connecting Google | Google app verification pending | Nothing to change |
| GBP reviews / media / posts (v4) | v4 access pending | Empty states say "needs a Google approval that is still pending" |

## Not planned (don't build)

Organic / website rankings, a Google / Local Finder switch, keyword search volume, Google Q&A, duplicate-listing detection, competitor citations / backlinks / authority, Google Analytics / Search Console, social login, review auto-send or background review drafting, text or logos inside AI images, video or ALERT posts. Source: `docs/backend/FRONTEND_REVIEW_CLAUDE_NOTE.md` §15.
