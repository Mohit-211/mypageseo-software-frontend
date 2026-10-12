# Note for the customer-app Claude: full review of everything built so far (2026-10-11)

Paste this into the customer frontend session (app.mypageseo.com). The backend is complete through Phase 9.1 and merged. **Please go through the whole customer app against this note.** For each feature, check that the screen exists, calls the endpoints listed, and behaves the way described here. Fix what you can. Report the rest back to us (format at the end).

This note is a map and a checklist. It does not repeat every response shape:
- **Shapes:** the backend repo's `docs/API.md` (the section names are given below).
- **Route catalogue:** `docs/ENDPOINTS.md` (305 endpoints, numbered).
- **Call sequences:** `docs/FLOWS.md`. These flows are run end to end by the backend tests, so they work exactly as written.
- **Screen → endpoint → status:** `docs/FRONTEND_BACKEND_MAP.md`.
- **Earlier notes this one builds on:** `RANKING_CONSISTENCY_CLAUDE_NOTE.md` (ranking pages), `POSTS_AI_FRONTEND_CLAUDE_NOTE.md` (posts, AI posts, AI review replies) and `CITATIONS_FRONTEND_CLAUDE_NOTE.md`. Where this note says "see the X note", that note has the detail and is still current.
- The copies in the frontend repo's `docs/backend/` are **out of date**. Use the backend repo's.

**Not in this note:** the admin panel (`ADMIN_CLAUDE_NOTE.md`, `ADMIN_PANEL.md`), the staff sales audit (Phase 19) and the marketing-site free audit (`MARKETING_CLAUDE_NOTE.md`). Those are separate apps.

---

## 0. What the product is, and the rules every screen follows

**The product:** MyPageSEO is a local SEO platform for US and Canadian businesses and agencies. It covers **Google Maps / Google Business Profile visibility only**. Website (organic) SEO is out of scope permanently.

The hierarchy is **Organization → Locations → modules**.
- An organization is a Business or an Agency.
- **Clients** (agency only) are an optional grouping of locations. They are not a level of the hierarchy, and no feature depends on them. A location may have no client.
- **A location is one business on Google Maps** and always has a Google `place_id`. It is added in only two ways (section 2). **There is no manual entry.**

**Data cadence:** each location refreshes automatically **once a month**. The order is: rank run, then GBP sync (if connected), then the GBP report. The user can also refresh by hand, at most once per 24 h per type, and that costs tokens. **Pages read stored data only**, so a number changes only after a refresh. Never show "live" wording.

**Rules for every call (please check the API layer):**

| Rule | What to check |
|---|---|
| Envelope | Every response is `{ success, status, message, data }`. |
| Errors | Error bodies carry `data.reason`. **Branch on `reason`, never on `message`.** Errors without a reason have `data: ""`. |
| Organization | Organization routes send `X-Organization-Id` (the current organization). If it's missing, the backend uses the user's default organization. A wrong one gives **403** `not_a_member`. A user in several organizations needs an organization switcher. |
| Sessions | Access tokens last 1 day; refresh tokens last 30 days and **rotate**. On a 401, call `POST /auth/refresh { refresh_token }` **once**, store **both** returned tokens, and retry the request. If the refresh fails, clear the tokens and go to login. Concurrent 401s must share one refresh call. |
| Roles | `owner` (everything), `member` (everything except organization settings, team and billing payments), `client_user` (agency; **read-only**, only its assigned clients' locations). A client_user's writes get **403** `read_only`. Hide the buttons rather than letting the call fail. Another organization's or client's location is a plain **404**. |
| 402 vs 403 | **402** is only for payment situations: `subscription_required`, `location_payment_required` (with a `quote`), `insufficient_tokens`. **403** covers everything else: `organization_suspended`, `enterprise_required`, `user_limit_reached`, `feature_not_included`, `agency_only`, `owner_only`, `read_only`. |
| Read-only organization | When the trial is over or a payment has failed, every money-costing action answers 402 `subscription_required`, but **reads keep working**. Show a banner linking to billing, and don't log the user out. |
| Suspended organization | 403 `organization_suspended`: "This account is suspended, contact support". No billing call to action. |
| Google attribution | Every response carrying Places content (business names, ratings, reviews) has an `attribution` field. Show it ("Google Maps") near those names and ratings. |
| Missing data | A section without data is `{ available: false, reason }`. Show an empty state that says **why**, using the reason. **Never invent or fill in sample data.** |
| Units | Kilometres everywhere for now. |

---

## 1. Auth and account (Phases 8, 8.1, 13b)

API.md: "Auth (`/api/v1/auth`)", "Sessions and the account", "The `/verify-email` page". FLOWS.md §0.

How it is meant to work:
- **Signup:** `POST /auth/signup { account_type: business|agency, name, email, password, organization_name, country: US|CA, accept_terms }`. This creates the user, the organization and the owner membership, then **emails a verification link** (not a code). Afterwards show "Check your email" with a resend button (`POST /auth/resend-verification { email }`, which always gives the same generic answer).
- **`/verify-email?token=…` page:** call `POST /auth/verify-email { token }` once on load. The answer depends on the case:
  - First verification: it returns a full session, so continue straight into onboarding.
  - `already_verified: true`: show "Already verified" and a Log in button. No error page.
  - `link_expired` / `link_invalid`: offer "Send a new link".
- **Unverified accounts are deleted 24 h after signup.** Say so on the "check your email" screen.
- **Login:** `POST /auth/login`. Before verification it answers **403** `email_not_verified` with a resend option. The session carries `organizations`, `current_organization_id` and `onboarding`. Use them to route to onboarding or the dashboard.
- **Forgot / reset password:** these use links only; there is no OTP anywhere.
  - `POST /auth/forgot-password { email }` emails a link to `/reset-password?token=…` (60 min, single use).
  - That page calls `POST /auth/reset-password { token, password, confirm_password }`. Possible errors: `link_expired`, `link_invalid`, `passwords_do_not_match`.
  - A successful reset ends every session, so send the user to login.
- **Account:**
  - `GET/PATCH /auth/me` (name, phone).
  - `POST /auth/change-password`: ends the user's other sessions.
  - `POST /auth/logout { refresh_token }`.
  - `POST /auth/deactivate`: deletes the account, disconnects Google and revokes all sessions. Confirm twice in the UI.
- **Rate limits:** 429 `rate_limited` with `retry_after_seconds`. Show the wait.
- **Not supported:** social login.

Check: signup → email → verify → onboarding works without a manual login step; the 401 → refresh → retry logic; the two link pages; logout really calls the backend.

## 2. Onboarding and adding locations (Phases 7a, 8, follow-ups 2026-10-01)

API.md: "Onboarding (Phase 7a)", "Onboarding (Phase 8 changes)", "Connected accounts, the connect modal and the Bind button". FLOWS.md §1–2. Also `docs/GBP_CONNECT.md`.

**`GET /onboarding/state`** says which step to show. The flow is resumable at any step, so a user who leaves and comes back lands on the right step. `POST /onboarding/skip` skips the organization-level steps.

**Two ways to add a location (and only these two):**

1. **Places search** (no Google connection needed):
   - Search: `GET /places/search?q=<name city>`. Each result has `already_added`.
   - Add: `POST /locations { place_id, client_id? }` → **201**.
   - **409** `duplicate_place` comes with the existing `location_id`. Offer to open it.
2. **Connect Google → pick → Bind:**
   - **Connect** (Google Identity Services popup): `GET /gbp/connect/popup` → open the GIS code client with those values → `POST /gbp/connect/code { code, state }` → `{ google_email, google_sub }`. The redirect fallback is `GET /gbp/connect/url`.
   - **Pick, in the same modal:** `GET /gbp/connections/:googleSub/locations` returns a checklist.
     - `supported: false` and `picked_by_other` rows are greyed out.
     - `bound_location_id` rows are shown as already bound.
     - Save the ticked rows with `PUT /gbp/connections/:googleSub/picks { gbp_location_ids }`.
   - **Bind, on the locations page:** `GET /locations` returns `pending_gbp` (the picked, unbound profiles). Each row gets a **Bind** button (`POST /gbp/picks/:pickId/bind { client_id? }`) and a **Remove** button (`DELETE /gbp/picks/:pickId`).
     - A pick whose place is already a location links to it (`existing_location_id`) and uses no new slot.
   - Up to **3 Google accounts per user**. A fourth gives 409 `google_account_limit`.

**Billing answers on add / Bind:** 402 `subscription_required`, 402 `location_payment_required` with a `quote` (pay, then retry; section 11), or 403 `enterprise_required` above 20 locations ("contact us").

**After adding:**
- **Centre (service-area businesses):** if `center_needed` is set, or the location has no centre, show the city / ZIP picker before anything else.
  - Autocomplete: `GET /places/autocomplete?q=&session=&locationId=`.
  - Save: `PUT /locations/:id/center { place_id, session }`.
  - Use one `session` token per picker session.
- **Keywords:** `PUT /locations/:id/tracking { keywords: [...] }`. 1–20 keywords, each 2–80 characters.
- **Competitors** (optional, at most 5):
  - Suggestions: `GET /locations/:id/competitor-suggestions` (up to 10).
  - Search: `GET /places/search?q=&locationId=`.
  - Save: `PUT /locations/:id/tracking { competitors: [place_id…] }`. Possible reasons: `too_many_competitors`, `own_place_id`, `invalid_place_id`.
- **Finish:** `POST /onboarding/complete { location_id }`. This queues the first rank run (which takes minutes) and the first GBP sync, and sets the monthly refresh day. Show "Your first ranking run is in progress" until the run is `done` or `partial`.
  - Poll `GET /locations/:id/rank-runs/:runId`.
  - Before the first run finishes, the ranking pages answer 404 `no_completed_run`. That's an empty state, not an error.

**Connected Google accounts:** `GET /gbp/connections` lists each account with its email, status (`revoked` = "connect again"), counts and bound `locations`.
- **Disconnect** (`POST /gbp/disconnect { google_sub }`) **deletes every location bound through that account.** Warn with exactly that, and list the locations by name.
- **Unbinding one location** (`POST /gbp/unbind`) keeps the location, with status `gbp_disconnected`.

**Agency onboarding:** clients are never a step. The "reporting brand" step is done once branding is saved, or it can be skipped.

Check: both add paths, the Bind button, the centre picker, the disconnect warning, the 402 / 403 handling, and that onboarding resumes on reload.

## 3. Locations list, overview, settings, refresh (Phases 7b, 8)

API.md: "Locations (`/api/v1/locations`)", "Refresh and GBP sync (Phase 7b)".

- **List:** `GET /locations?search=&client_id=&status=&sort=&order=&page=&limit=`.
  - Columns: name, city, client, rank (`rank.display` / `rank.status`, plus change), GBP score + grade, rating / reviews, Citations (`citations.score`), status, last / next refresh.
  - Sort keys: `name | city | rank | gbp_score | rating | citation_score | last_refreshed`.
  - `pending_gbp` rows sit above the list (section 2).
- **Status badge**, first match wins:
  - `setup_required`: "Finish setup", linking to onboarding.
  - `reconnect_required`: "Reconnect Google".
  - `gbp_disconnected`: "Google disconnected".
  - `gbp_not_connected`: "Connect Google" (optional).
  - `active`.
- **Overview** (`GET /locations/:id` + `GET /locations/:id/overview`): the header plus cards for rankings, GBP score + top fixes, performance, reviews, competitors and citations, plus refresh and `empty_states`.
  - Every card can be `{ available: false, reason }`. Use the reason: `no_keywords`, `no_ranking_data`, `gbp_not_connected`, `no_report`, `no_competitors`, `v4_access_pending`, `no_citations_yet`, `not_checked_yet`.
  - Show "Measured around: {center.label}". `center.source` is `place` (the business's own pin) or `manual` (a city / ZIP chosen at setup).
- **Settings:**
  - `PATCH /locations/:id { name?, timezone?, client_id? }`.
  - Business data (address, phone, website) comes from Google and **can't be edited**. Don't show edit fields for it.
  - `DELETE /locations/:id` is a soft delete that frees the slot for the rest of the paid period, with no refund. Say so in the confirm dialog.
- **Refresh button:** `GET /locations/:id/refresh` gives `next_allowed_at` per type, the monthly `next_refresh_at`, active runs, `report.pending` and `tokens { cost, balance }`.
  - Show the token cost on the button. Disable it until `next_allowed_at`.
  - Trigger with `POST /locations/:id/refresh { types?: ["rankings","gbp"] }`.
    - A rate-limited type comes back as `skipped: "rate_limited"`. If every type is limited, the answer is **429**.
    - **402** `insufficient_tokens { balance, cost, costs_by_type }`: link to buying tokens. Nothing was charged.
  - A refresh that fails entirely is refunded automatically.
  - "Run now" (`POST /rank-runs`) is the same as a rankings refresh and shares its limit.

## 4. Ranking pages (Phases 4, 5, 12.5, 17, consistency review 2026-10-08)

API.md: the ranking sections at the top, "Explicit statuses and scopes on the ranking pages", "Keyword groups", "Keyword history". **The detailed checklist is the ranking consistency note; please confirm you finished it.** In short:

How ranking works (so the copy is right):
- Ranks come from **Google Places API Text Search**, used as the proxy for Google Maps.
  - Copy for the pages: "Rankings are Google Maps results, measured with the Google Places API from each point around your business."
  - There is **no** Google / Local Finder / organic switch. Remove one if it exists.
- Each point is searched **3 times, 60 s apart**, and the median is used. A business can be found up to position 60; below that the rank shows as **"60+"** and counts as 61 in averages. A failed search is `error` and shows as "–". **Never show an error as 60+.**
- **One run powers all three pages:**
  - **Rank Tracker** (`GET /locations/:id/rank-tracker`): the average over 5 points (the centre plus N / S / E / W) per keyword and overall, with change and a 12-run trend. `?group=` filters by keyword group.
  - **Local Search Grid** (`GET …/grid?keyword=`): a heatmap from 3×3 up to 13×13. Each cell has `samples` and `spread`.
  - **Map Ranking** (`GET …/map-ranking?keyword=&point=C|N|S|E|W`): Google's named top 20 at one point. The client is highlighted, and every result has map pins (`lat`, `lng`, `address`).
- **Grid settings** live in `PUT /tracking { grid: { size, radius_km } }`. Sizes are 3–13; the radius is 0.5–15 km; the default is 7×7 at 8 km. Before saving, show the run time and the cap from `GET /tracking/estimate`.
- **Change** is `previous − current`, so **positive means improved**.
  - `entered_top_60` / `dropped_out_of_top_60` have `change: null`. Show the words instead.
  - The overall change is computed on the shared keywords only: "+2.1 (on 3 of 5 keywords)".
- **Averages carry `status` and `display`:** `ok` / `not_found` ("60+") / `no_data` ("No data", meaning we couldn't get results from Google). The two missing cases need different messages. Each page's `scope.description` says what was measured; use it as the subtitle.
- **Two averages:** the Rank Tracker average (5 points) and the grid average are different numbers. Label both, and never use one in place of the other.
- **Map Ranking is "who ranks at this point".** Never call it "who ranks higher than you".
- **History:**
  - `?runId=` on every page. When the user picks an older run, every page and header uses it.
  - `GET /rank-runs` lists the run history.
  - `GET /keyword-history?keyword=` gives one keyword's chart.
- **Keyword groups:** `GET/POST /locations/:id/keyword-groups`, `PATCH/DELETE …/:groupId`. Up to 20 groups; a keyword can be in several.
- **Competitors** (max 5) are ranked from the same searches as the client, keyed `competitor_1…5` in `targets` with their names. Offer "Track this competitor" on Map Ranking rows and suggestion lists.
- **Not supported:** search volume, organic ranks, a "Google Local Pack" from a results page. The top-3 rate is the **Maps** top 3.

## 5. GBP report, profile audit and competitors (Phases 7b, 7c, v2 on 2026-10-02)

API.md: "GBP report (Phase 7c)", "Competitor rows". `GET /locations/:id/gbp/report?range=28d|90d|12m`.

- **Performance:**
  - Totals, the previous period and the same period last year.
  - By day, by surface (Maps / Search) and by device.
  - Actions per 1,000 impressions.
- **Search keywords:** the terms people used to find the profile, from Google. Some values are thresholds (e.g. "< 15"); show them as thresholds, not numbers. `notTracked` lists terms that aren't tracking keywords yet; offer "Track this keyword".
- **GBP Score (v2):**
  - The score, a grade A–F, 4 pillars (completeness, activity, reviews, performance), checks with `state` (pass / partial / fail / not_available) and `why_it_matters`, and the top 5 fixes.
  - `partial: true` + `excluded_pillars` means some pillars had no data and the rest were rescaled. Say so.
  - `score_history[].version` marks the formula change. Draw a break in the chart there.
  - **The GBP report has no ranking numbers by design.** Ranks live on the ranking pages.
- **Profile:** everything the Business Profile shows, plus `pending_google_edits`, `verification` and `new_review_uri` (for an "Ask for a review" link).
- **Competitor comparison** (also works without GBP): Public Score, rating, review count, category, hours, website, phone, photos ("10+" when `photos_capped`), up to 5 recent reviews with their author, and up to 5 rule-based insights.
  - Row sources: `tracking` ("Your competitor"), `area` ("Top in your area": the businesses ranking highest across the latest grid) and `map_list` ("Nearby business", only on older runs).
- **Without GBP**, the private sections are `{ available: false, reason: "gbp_not_connected" }`, and only the competitor comparison is filled. Show a "Connect Google" call to action there.
- **Freshness:** `GET /locations/:id/gbp/sync` gives the state per data type. `GET /refresh` → `report.pending` means a new report is being generated (about 2 minutes after a sync or run).
- **Known empty field:** `verification` is empty until Mohit enables one more Google API. Show "Not available", not an error.

## 6. Reputation: reviews and AI replies (Phase 18, changed in 9.1)

API.md: "Reviews and AI (Phase 18)". **Detail: the posts / AI note, §7.**

- **Summary:** `GET /locations/:id/reviews/summary`. Stat cards: total, new this month, replies sent, flagged, awaiting attention, drafts pending.
- **List:** `GET …/reviews` with filters and checkboxes.
- **Refresh Reviews:** `POST …/reviews/refresh`, once per 15 min. A refresh too soon gives 429 `rate_limited` + `next_allowed_at`.
- **Flags:** every review has deterministic `flags` / `flag_level` (no AI). The wording is **"Suspicious indicators"**, never "fake".
- **AI reply drafts** cover every unreplied review **except suspicious ones**.
  - The "Draft all unreplied" button (`POST …/reviews/drafts/all`) does 50 per click, with "Continue (N left)".
  - Selected reviews: `POST …/reviews/drafts`.
  - Edit or remove a draft: `PUT/DELETE …/reviews/:reviewId/draft`.
- **Sending is always the user's click:** `POST …/reviews/send { review_ids }`, up to 100 per call, with per-review results. Delete a reply with `DELETE …/reviews/:reviewId/reply`.
- **Other AI actions:**
  - Analysis: `POST …/reviews/analyze`.
  - Removal-request text: `POST …/reviews/:reviewId/appeal-draft`. **Google has no report API**, so show the text plus Google's link; the user submits it there and records the outcome with `PATCH …/report-status`.
  - Insights: `GET/POST …/reviews/insights`.
- **AI errors (every AI route):**
  - 402 `insufficient_tokens`: offer to buy tokens.
  - 503 `ai_not_configured`: hide the AI buttons.
  - 503 `ai_budget_reached`: "AI is paused for today".
  - 502 `ai_failed`: "Try again" (nothing was charged).
  - Show each AI button's token cost from `GET /billing` → `tokens.ai_costs`.

## 7. GBP posts, AI posts and auto-posts (Phases 9, 9.1)

**The posts / AI note covers this fully (§1–6, §8). Please confirm each of its sections.** In short:
- **Posts page:** tabs by status, counts from `summary.stats`, and a Refresh button (once per 15 min) that reads states back from Google and imports posts made there.
- **Editor:** standard / event / offer, a button, one photo (cropped to 4:3), event / offer dates and repeats. Show `issues` and `warnings` live. Save draft / Schedule / Publish now.
- **Approval:** `off | team | client`. When `needs_approval` is true, the buttons say "Send for approval".
- **AI:** "Write with AI", "Create image" and "Regenerate", each showing its token cost.
- **Auto-posts:** a series writes each post about 48 h ahead and publishes it unless the user changes it. The setup copy must say that it spends tokens automatically.
- **Calendars:** per location and across all locations.
- **Photos** need a public HTTPS API URL. On a dev server `photos_publishable` is false; say so near the photo picker.

## 8. Citations (Phase 16)

**The citations note covers this fully.** Citations are **managed by the MyPageSEO team**; customers only read them.
- Citations page: `GET /locations/:id/citations`.
- Changes: `…/citations/changes`.
- Also on the locations list, the overview card, both dashboards, and the Citation Report.
- No add / edit / "check now" buttons.

## 9. Dashboards (Phase 11, extended 2026-10-02 and later)

API.md: "Dashboard and team (Phase 11)". `GET /dashboard[?location_id=&range=15d|30d|60d&page=&limit=&sort=&order=]`.

- **Business shape:**
  - Visibility: average rank with `avg_rank_status` / `avg_rank_display`, change, top-3 rate and trend.
  - GBP Score + grade + change, rating / reviews, ranking movement, key competitor (with both statuses), last / next refresh.
  - Blocks: `performance` (follows `range`), `reviews`, `citations`.
  - Top 5 `recommended_actions`.
- **Agency shape:** client and location counts, portfolio averages (rank, GBP Score, citation score, top-3 change), statuses (reconnect / setup), declines, GBP issues, `reports { ready, scheduled, failed }`, and the portfolio table (paged and sortable).
- **A client_user** gets the agency shape limited to its clients.
- **`location_id`** narrows every block to one location; `locations` keeps the full list for the picker. **`range`** drives only the GBP performance and review figures. They come from stored data, so they move only after a refresh.
- **Recommended actions:** each has a `source` and an id. Every one should link somewhere useful:
  - Setup: reconnect, finish setup.
  - Ranking: dropped keywords, declines, competitor ahead.
  - GBP: score fixes.
  - Citations: `citations:nap_wrong`, `citations:not_found`.
  - Reviews: `reviews:attention`, `reviews:suspicious`.
  - Posts: `posts:failed`, `posts:approval`, `posts:stale`, `posts:series_problem`.
  - Please check that every id has a target.
- "Local Visibility score" means the average-rank block. There is no separate score.

## 10. Reports center, white-label and share links (Phase 12, plus citation and reputation types)

API.md: "Reports center (Phase 12)".

- **Types:**
  - `rank_tracker`, `gbp_audit`, `competitor_analysis`, `citation`, `reputation`.
  - `full` combines rank_tracker, gbp_audit, competitor_analysis and citation. Reputation is also a part of full.
  - `sections` is optional. Type-specific errors: 400 `no_citations_yet` or `no_reviews` (disable that type for the location and say why).
- **Create:** `POST /reports { location_id, type, sections?, run_id?, range? }`, then poll `GET /reports/:id` until `ready` (usually a second or two).
- **A report is a frozen snapshot.** It never changes when new data arrives; say "Data as of {run_at}". Reports older than 24 months become `expired`.
- **Viewer:** `GET /reports/:id` → `document.blocks` (heading, paragraph, kpis, table, line_chart, heatmap, list, unavailable, page_break). **Render these blocks.** They are exactly what the PDF shows. An `unavailable` block says why ("Not available yet"); never fill it.
- **Library:** `GET /reports` with filters `location_id`, `client_id`, `type`, `status` (incl. `archived`) and `include_deleted`.
  - Reports of deleted locations stay, with `location.deleted: true`.
  - `live` rows (the stored GBP report, review insights) open the in-app page and have no PDF.
- **Actions:**
  - PDF: `GET /reports/:id/pdf`.
  - Email: `POST /reports/:id/email { recipients, message? }`. Above 10 MB the email carries a 30-day link instead of the attachment.
  - Archive: `DELETE /reports/:id`.
- **Share links:**
  - Create: `POST /reports/:id/share { expires_in_days? }`. **The URL is shown once**; tell the user to copy it.
  - List: `GET /reports/:id/shares`. Revoke: `DELETE …/shares/:shareId`.
  - The public page `/r/<token>` is served by the backend (branded, noindex), not by the app.
- **Schedules:** `GET/POST /report-schedules`, `GET/PATCH/DELETE /report-schedules/:id`.
  - Monthly only. Sent **after each covered location's automatic monthly refresh**, not on a fixed date.
  - Scope is a location or a client (agency).
  - Show `next_expected`, `last_sent_at` and `last_error`.
- **White-label (agency only, owner edits):**
  - `GET/PUT /organization/branding`: name, colours, footer / contact text, hide MyPageSEO, sender name, reply-to.
  - `GET/PUT/DELETE /organization/branding/logo`: PNG / JPEG ≤ 512 KB, sent as base64 JSON.
  - Business organizations use the default branding; hide the page for them.

## 11. Agency: clients, team, client users (Phases 8, 11)

API.md: "Clients", "Team (owner only)", "Accepting an invitation". FLOWS.md §2–3.

- **Clients** (agency only; a business gets 403 `agency_only`, so hide the menu):
  - `GET/POST /clients`, `GET/PATCH/DELETE /clients/:id`.
  - Assign a location: `POST /clients/:id/locations { location_id }`. Unassign: `DELETE /clients/:id/locations/:locationId`.
  - Reassign: `PATCH /locations/:id { client_id }`.
  - The client detail page shows its locations, a summary (averages over locations with data), and its reports and schedules (`?client_id=`).
- **Team** (owner only):
  - Members: `GET /organization/members`.
  - Invitations: `POST/GET /organization/invitations`, `DELETE …/:invitationId`.
  - Members: `PATCH/DELETE /organization/members/:userId`.
  - A client_user invitation carries `client_ids`.
  - Over the user limit: 403 `user_limit_reached { used, limit }`. The limit is 3 users per paid location, pooled, owner included.
  - The owner can't be removed, and ownership can't be transferred.
- **Invitation page** (`/invite?token=…`):
  - Look up the invitation: `POST /auth/invitations/inspect { token }`.
  - Accept: `POST /auth/invitations/accept`. A new account sends `{ token, name, password }`; an existing account sends `{ token }`.
  - The answer is either a session (signed in, already verified) or `login_required`.
- **client_user experience:** only its clients' locations, reports and dashboard. Everything read-only, with one exception: approving / rejecting posts in `client` approval mode. Please log in as a client_user and walk every page looking for buttons that should be hidden.

## 12. Billing and tokens (Phase 13a, 13c)

API.md: "Billing (Phase 13a)". FLOWS.md §4. One billing page.

**The model:**
- **Per location:** the first location is priced higher; each additional location costs less. All features are included.
- **Cap:** 20 locations on the standard plan; above that is enterprise ("contact us").
- **Trial:** 7 days, no card. Afterwards the organization is read-only until it subscribes.
- **Tokens:** one-time packs that never expire. The monthly automatic refresh is free. Manual refreshes and AI actions cost tokens. Coupons apply to token packs only.

**Endpoints and states:**
- **`GET /billing`:** `state` (`trialing | active | past_due | inactive | suspended_by_admin`), `trial_ends_at`, `grace_ends_at`, plan, prices, subscription, next renewal, `locations` / `users` / `tokens` (balance, `monthly_grant`, `next_grant_at`, `ai_costs`), and billing details. Show a trial / grace banner across the app from this.
- **Subscribe:** ask how many locations first, then `POST /billing/checkout { quantity }` (1–20, at least the active count). Redirect to `approve_url`.
  - On the PayPal return (`/settings/billing?checkout=success`), call `POST /billing/sync`.
  - **409** `price_not_set` means prices haven't been set yet (they aren't today). Show "Billing opens soon", not an error.
- **Extra location slot:**
  - Quote: `GET /billing/location-slots/quote`.
  - Order: `POST /billing/location-slots { quantity }` → PayPal.
  - On return (`order=return&token=<id>`), capture with `POST /billing/orders/<id>/capture`, then retry the add.
- **Token packs:**
  - List: `GET /billing/token-packs`.
  - Coupon: `POST /billing/coupon/validate`.
  - Buy: `POST /billing/tokens/checkout`, then capture as above.
  - Ledger: `GET /billing/tokens/ledger`.
- **Other actions:**
  - Cancel: `POST /billing/cancel`.
  - Billing details: `PATCH /billing/details`.
  - Invoices: `GET /billing/invoices`, `GET /billing/invoices/:id/pdf`.
- **Roles:** the owner pays and edits, a member reads, a client_user has no access.
- **Public pricing** (marketing site): `GET /pricing?country=US|CA`.
- **No live PayPal yet.** The sandbox test is pending, so the PayPal round trip can't be tested end to end today. Check the screens and the redirects.

## 13. Settings, usage and support (Phases 8, 12.5, 13b)

- **Organization:** `GET/PATCH /organization` (owner edits name and country).
- **Usage:** `GET /organization/usage` gives locations / keywords used vs limit, clients, and `api_usage` (Google calls per month, counts only). Showing usage is optional.
- **Profile:** `GET/PATCH /auth/me`. Delete account: `POST /auth/deactivate`.
- **Integrations:** Google only (the connected accounts, section 2). Google Analytics / Search Console are not supported.
- **Support tickets** (every role; a client_user sees only its own):
  - `POST/GET /support/tickets`, `GET /support/tickets/:id`, `POST …/messages`, `POST …/close`.
  - Statuses: `open → in_progress → waiting_on_customer → resolved → closed`.
  - Replying reopens a resolved ticket. A closed ticket answers 409 `ticket_closed`.
  - Team replies show as "MyPageSEO team".
- **Not built yet:** notification settings (Phase 15), automations, security settings. Hide these or show "Coming soon"; don't fake them.

## 14. Built but not live yet (don't treat these as frontend bugs)

| Feature | Today | What the UI should do |
|---|---|---|
| AI (review drafts, post text, images, auto-posts) | No OpenAI key on the server yet | **503** `ai_not_configured` → hide the AI buttons and auto-posts setup, or show "Coming soon". Must not crash. |
| Publishing posts to Google | Built and tested offline; the first live post is pending | Flows work; real publishing may fail with `error.message` on the post. |
| GBP verification status | Empty | "Not available" |
| PayPal checkout | No prices and no sandbox yet | **409** `price_not_set` → "Billing opens soon" |
| Real customers connecting Google | Google app verification pending; only test accounts can connect | Nothing to change; just know it. |
| Approval and other notifications / emails | Phase 15 | No notification UI |
| GBP Score thresholds | Starting values, not calibrated | Show as is. |

## 15. Don't build (no data exists, by design)

Organic / website rankings, a Google / Local Finder switch, keyword search volume, Google Q&A, duplicate-listing detection, competitor citations / backlinks / authority, Google Analytics / Search Console, social login, review auto-send or background review drafting, text or logos inside AI images, video or ALERT posts, automations screens, white-label hosting on a custom domain (planned, spec pending), and AI visibility (planned). If a design shows one of these, remove it or show a "not available" state, and list it in your report.

---

## How to test locally

- **Backend:** `npm run seed:demo-orgs` creates a demo Business and Agency organization with locations, runs, GBP reports, citations, reports, a schedule, a share link, a pending invitation and a revoked connection. `npm run dev` serves `http://localhost:5000/api/v1` (`PORT` in the backend `.env`). The live API is `https://api.mypageseo.com/api/v1`; keep the URL in one env variable.
- **Emails:** locally (`EMAIL_TRANSPORT=log`) nothing is sent. The backend log prints each link (verify, reset, invitation) with the email masked. Open the link by hand.
- **CORS:** every frontend origin must be in the backend's `ACCESSDOMAINS`. A CORS error in the browser usually means a missing origin, not a broken endpoint.
- **Postman:** `docs/postman/` in the backend repo has a collection generated from ENDPOINTS.md.

## How to report back

Reply with one line per section (0–15):

- **OK:** the app matches.
- **Changed:** what you fixed, in a short list.
- **Missing in the app:** a screen or behaviour not built yet. Say whether you will build it.
- **Backend question / gap:** something the design needs that the backend doesn't give, or a response that differs from API.md. Include the endpoint, what you sent, what came back (status + `data.reason`) and what you expected.

Also list any endpoint the app calls that is **not** in `docs/ENDPOINTS.md` (it would be a removed legacy route), and any screen that shows data the backend doesn't provide. Mohit will pass your report to the backend Claude.
