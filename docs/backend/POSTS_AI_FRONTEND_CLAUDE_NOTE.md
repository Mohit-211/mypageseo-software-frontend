# Note for the customer-app Claude: GBP posts, AI posts, auto-posts and AI review replies (2026-10-09)

Paste this into the customer frontend session (app.mypageseo.com). It answers item 3 of your 2026-10-09 note ("GBP posts + AI posts"). It also covers the AI review-reply change to the Reputation page.
- **Shapes:** the backend's `docs/API.md` sections "GBP posts (Phase 9)", "AI posts and auto-posts (Phase 9.1)" and "Reviews and AI (Phase 18)".
- **Route catalogue:** `docs/ENDPOINTS.md` (#191–#224).
- Copies of those docs in the frontend repo's `docs/backend/` are **out of date**; use the backend repo's.

---

The backend is complete and merged (Phases 9 and 9.1). Everything below is live. All routes need the user token and the organization header, as usual.
- **Paths:** `…/posts` means `/api/v1/locations/:locationId/posts`.
- **Client users:** a client_user can read everything here but change nothing, with one exception: in `client` approval mode it can approve or reject posts.
- **Errors:** every error body has `data.reason`; branch on it, not on the message.

## 1. Posts page (per location)

**Load:** `GET …/posts/summary` + `GET …/posts?status=…&page=&limit=`.

**Summary drives the page header:**
- **`stats`:** `drafts`, `pending_approval`, `scheduled`, `published`, `failed`, `rejected`, `published_last_30_days`, `last_published_at`, `next_scheduled_at`, `series_problems`. Use them as tab counts.
- **`connection`:**
  - `{ gbp_connected, v4_enabled, photos_publishable }`. If `gbp_connected` is false, show "Connect this location to Google to publish". Drafts can still be written.
  - If `photos_publishable` is false (a development server), uploads work but publishing a photo fails; say so near the photo picker.
- **`you`:**
  - `{ role, needs_approval, can_approve }`. When `needs_approval` is true, label the buttons **"Send for approval"** instead of "Publish now" / "Schedule".
  - Show Approve / Reject only when `can_approve` is true.
- **`settings`:** `{ approval: off|team|client, default_cta, language_code }`.

**Tabs:** Drafts (`draft`), Waiting for approval (`pending_approval`), Scheduled (`scheduled,publishing`), Published (`published`), Problems (`failed,rejected`). The list takes a comma list: `?status=failed,rejected`.

**Post card** (the post object):
- `type` (standard / event / offer), `summary`, `media[0].url` (or `google.media_url` for posts made on Google), `cta`, `event`, `offer`, `status`.
- `scheduled_at` / `published_at`, `source` (`manual` | `ai` | `google`): show a small "AI" or "From Google" tag.
- `google.search_url`: "View on Google" when published.
- `error.message` on failed or rejected posts.
- `approval`: who decided and the note.
- `google.missing: true`: "Deleted on Google", and only Delete is offered.

**Refresh posts button:** `POST …/posts/refresh`.
- Reads states back from Google and imports posts made on Google.
- **429** `refresh_too_soon` + `next_allowed_at` (once per 15 min): disable the button until then.

## 2. Post editor

- **Fields:**
  - **type:** standard / event / offer.
  - **summary:** ≤ 1,500 characters; show a counter.
  - **button `cta`:** `{ type: BOOK|ORDER|SHOP|LEARN_MORE|SIGN_UP|CALL, url }`. `CALL` has no URL; the others need https. Offers have **no** button (Google shows its own).
  - **event:** `{ title ≤ 58, start: { date: "YYYY-MM-DD", time?: "HH:mm" }, end: {…} }`, for events and offers. Without a time it covers the whole day; dates are the location's local dates.
  - **offer:** `{ coupon_code, redeem_url, terms }`.
  - **repeats:** `recurrence`, events and offers only: daily; weekly with days; monthly with a day of the month **or** "the n-th weekday"; `ends_on` within a year.
  - **one photo:** `media_ids: [id]`.
- **Live feedback:**
  - Every post object returns `issues` (what blocks publishing: `[{ field, code, message }]`) and `warnings` (hints such as "phone number in the text").
  - Show issues next to their `field`, and warnings as soft notes.
  - A draft may be incomplete; scheduling or publishing an incomplete post → **422** `post_incomplete` with the same `issues`.
- **Save / Schedule / Publish:**
  - **Create:** `POST …/posts { …fields, action: "draft" | "schedule" | "publish", scheduled_at? }`.
  - **Edit:** `PATCH …/posts/:postId { …changed fields }`.
  - **Actions on a post:** `POST …/posts/:postId/schedule { scheduled_at }` (2 min – 1 year ahead), `/publish`, `/unschedule`, `/retry` (failed only), `/duplicate`; `DELETE …/posts/:postId`.
  - **Read the answer's `status`:** `published`, `scheduled`, `pending_approval`, or `failed` / `rejected` with `error`. The post is never lost.
- **Editing a published post** updates it on Google (only the changed fields). Its type can't change (**409** `type_change_on_published`: offer "Duplicate" instead).
- **Photos:**
  - **Upload:** `POST …/posts/media` as multipart, field `file` (JPEG/PNG ≤ 5 MB, ≥ 250×250). It comes back cropped to 4:3.
  - **Upload errors:** `media_type`, `media_too_small`, `media_too_large`, `media_too_plain`.
  - **Gallery:** `GET …/posts/media`.
  - **Delete:** `DELETE …/posts/media/:mediaId` (**409** `media_in_use`).
- **Conflicts:** **409** `invalid_status` (it includes `allowed_from`) or `post_changed`: reload the post and show the current state.

## 3. AI in the editor (new in 9.1)

Every AI button shows its token cost. Read the costs from `GET /billing` → `tokens.ai_costs` (`post_draft`, default 1; `post_image`, default 3).

**AI errors (every AI route):**
- **402** `insufficient_tokens` `{ balance, cost }` → link to buy tokens.
- **503** `ai_not_configured` → hide the AI buttons.
- **503** `ai_budget_reached` → "AI is paused for today".
- **502** `ai_failed` → "Try again"; nothing was charged.

**Buttons:**
- **"Write with AI":** `POST …/posts/ai-draft { topic, tone?: friendly|professional|enthusiastic|informative, type?, cta_type?, variants?: 1–3 }`
  - → `{ drafts: [{ summary, event_title, cta_type, image_idea }], tokens_spent }`.
  - Show the variants as cards and fill the editor with the chosen one (nothing is saved yet).
  - Save with `source: "ai"`, and use `image_idea` as the default text for "Create image".
- **"Create image":** `POST …/posts/ai-image { prompt_hint } | { post_id }` (+ optional `style`)
  - → **201** `{ media: { media_id, url, … }, style, tokens_spent }`. Put `media_id` into `media_ids`.
  - **Style picker** (optional; without it styles rotate): `photo_scene` Realistic photo · `lifestyle_photo` Lifestyle photo · `detail_photo` Close-up photo · `flat_illustration` Flat illustration · `render_3d` 3D render · `watercolor` Watercolour · `photo_wide` Wide photo.
  - Generating takes 10–60 s, so show a progress state.
- **"Regenerate"** on a draft, scheduled, waiting or failed post: `POST …/posts/:postId/ai-regenerate { text?: true, image?: false, topic?, tone? }` → `{ post, tokens_spent }`. A scheduled post keeps its time.

## 4. Auto-posts (AI series, new in 9.1)

An "Auto-posts" tab (or panel) on the Posts page. The user sets a schedule once. The server writes each post (text, plus an image when on) **about 48 h before** its time. The post shows up in the list and calendar as `scheduled` with `source: "ai"` and `series_id`, and **publishes on time unless the user edits, regenerates, unschedules or deletes it**. Approval modes apply as for any post.

- **List:** `GET …/post-series` → `{ series: [series], limit: 3 }` (at most 3 active per location).
- **Create:** `POST …/post-series`

  ```json
  { "name": "Weekly tips", "cadence": { "kind": "weekly", "days_of_week": ["MONDAY","THURSDAY"] }, "time_of_day": "09:00",
    "starts_on": "2026-10-12", "ends_on": null, "topics": ["…", "…"], "tone": "friendly", "cta": { "type": "CALL" },
    "include_image": true, "instructions": "House rules, ≤ 500 chars", "lead_hours": 48 }
  ```

  - Other cadences: `{ kind: "every_n_days", n: 1–30 }` and `{ kind: "monthly", day_of_month: 1–28 }`.
  - `time_of_day` is in the location's time zone; show the series' `time_zone`.
  - Errors: **400** `gbp_not_connected` (the location must be connected first), `ends_before_start`; **409** `too_many_series`.
- **Setup form copy:** say plainly that each post costs tokens (`post_draft` + `post_image` when images are on, 4 by default) and that posts publish automatically unless changed. Creating the series is the user's consent to that spend.
- **Series card:** name, cadence in words, `next_slots` (the next 3 times), `posts_generated`, active toggle.
  - **Pause / resume:** `POST …/post-series/:seriesId/pause` | `/resume`; resume can answer **409** `too_many_series`.
  - **Problems:** `last_error` (`insufficient_tokens`, `ai_not_configured`, `ai_budget_reached`, `ai_failed`, `gbp_not_connected`). Show it as a warning, e.g. "Not enough tokens: Monday's post was skipped". It clears on the next success. Failed slots are retried hourly until their time passes.
  - **`history`** (newest first): `generated` / `failed` + `reason`. `image_failed` means that post went out text-only.
- **Edit:** `PATCH …/post-series/:seriesId` (any create field; applies to posts not generated yet).
- **Preview:** `GET …/post-series/:seriesId/preview?count=5` → `{ time_zone, slots: [{ slot_at, topic, generates_at }] }`. No AI, free; good for a "what's coming" list.
- **Generate a sample:** `POST …/post-series/:seriesId/generate-next` → **201** `{ series, post }`. Makes the next slot's post now and spends tokens; open the post in the editor afterwards.
- **Delete:** `DELETE …/post-series/:seriesId?keep_scheduled=false`. Ask: "Also cancel its scheduled posts?" Default yes: they move to Drafts. `keep_scheduled=true` lets them publish. Published posts always stay.

## 5. Approval

- **Settings** (owner only; others **403** `owner_only`): `PUT …/posts/settings { approval: "off"|"team"|"client", default_cta, language_code }`.
  - `team`: a member's posts wait for the owner.
  - `client` (the location must belong to a client, else **400** `no_client`): every post waits for the client user.
- **Approve or reject:** `POST …/posts/:postId/approve { note? }` publishes at `scheduled_at`, or now if that has passed or there is none. `POST …/posts/:postId/reject { note }` sends it back to Drafts with the note.
  - When an owner approves in client mode, show "approved on the client's behalf" (`approval.on_behalf`).
- **No emails yet** (Phase 15). Use `stats.pending_approval` and the dashboard action for visibility.

## 6. Calendars

- **Per location:** `GET …/posts/calendar?from=&to=` (ISO, ≤ 93 days).
- **All locations (agency):** `GET /api/v1/posts/calendar?from=&to=&location_ids=a,b` (adds `location_name` and a `locations` list for a filter).
- **Items:** `{ post_id, location_id, type, status, source, date, summary (≤ 140), event, recurrence }`. `date` is the publish time or the scheduled time; drafts are not on the calendar. Colour by `status`, and tag `source: "ai"`.

## 7. Reputation page: AI replies for all unreplied reviews (changed in 9.1)

- **What changed:** AI drafts now cover **every rating** (1–5★). Only reviews flagged `suspicious` are skipped: offer "Report" for those instead.
  - 1–3★ drafts follow careful rules (apology, no offers, invite contact). The user still reviews every draft and **sending is always the user's click**.
  - The old skip reason `rating_not_eligible` no longer exists.
  - Remove any "write low-rating replies yourself" copy. `ai_reply_eligible` on each review is now true for any unreplied, non-suspicious review.
- **"Draft all unreplied" button:** label it from `GET …/reviews/summary` → `ai.draftable` and `ai.draft_all_cost`, e.g. "Draft 37 replies · 4 tokens". Disable it at 0.
  - **Call:** `POST …/reviews/drafts/all { regenerate?: false }` → `{ drafted, remaining, tokens_spent, drafts: [review] }`.
  - **50 per call** (10–15 s, so show progress). While `remaining > 0`, offer "Continue (N left)".
  - **402** `insufficient_tokens` `{ cost, balance, reviews }` comes **before** anything is spent.
  - Drafts the user wrote or edited are kept unless `regenerate: true`.
- **Bulk send:** show the drafts (`GET …/reviews?has_draft=true&replied=false`) with checkboxes and "Select all". Send with `POST …/reviews/send { review_ids }`, **up to 100 per call** (batch larger selections).
  - The answer has per-review `results` (`sent` / `failed` / `skipped` + `reason`). Show the failures inline.

## 8. Dashboard

`GET /dashboard` → `recommended_actions` with `source: "posts"`:
- `posts:failed` → the Problems tab.
- `posts:approval` → the Waiting tab.
- `posts:stale` → the editor: "no post in 30 days".
- `posts:series_problem` → the Auto-posts tab.

## Don't build

- **Review automation:** auto-sending review replies, or background review drafting. Drafts come only from the buttons.
- **Text in images:** in-image text or logo overlays.
- **Video posts, and ALERT ("COVID") posts:** not supported.
- **Editing Google's own photo of an imported post:** not possible.
- **Notifications or emails for approvals:** Phase 15.
- **Per-location AI settings** (style or tone presets beyond the fields above): later ("AI settings").
- **AI visibility:** later.

If a design needs something that isn't here, ask Mohit to have the backend Claude add it.
