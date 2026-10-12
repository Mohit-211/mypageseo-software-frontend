# Note for the customer-app Claude: citations (2026-10-08)

Paste this into the customer frontend session (app.mypageseo.com). It covers everything citation-related in the customer app. Examples are in `docs/API.md` "Citations (Phase 16)", "Locations" and "Reports center"; the route catalogue is `docs/ENDPOINTS.md`.

---

The backend for citations is complete. Citations are **managed by the MyPageSEO team** in the admin panel: they pick the directories (Yelp, Data Axle, HomeStars, …) for each location, check each listing by hand and record what they find. **Customers only read.** There are no buttons to add, edit or check a citation, and no automatic citation scan, so don't promise one in the UI.

All routes need the user token and, as with every organization route, the organization header. A client_user sees only its clients' locations; another organization's location → 404.

## Where citations appear

### 1. Citations page per location
`GET /api/v1/locations/:locationId/citations[?status=]`
- **Score card:** `health.score` (0–100) + `health.grade` (A–F), `health.coverage` (the share of listings checked; show it as "5 of 6 checked"), `last_checked_at`.
- **Status counts** (`counts`): Live & correct, Wrong NAP, Not listed, Duplicate, Submitted, Pending, Not checked yet. The counts double as filter chips (`?status=`).
- **Table** (`citations[]`, problems already first): directory name + type, a status badge, NAP issues, "View listing" (`listing_url`), last checked.
  - `nap_issues: [{ field, found, expected }]`: show for example "Phone: listed as (416) 555-0199, should be 416 555 0100".
- **Recent changes** (`recent_changes`): "Data Axle: Not checked → Wrong NAP, 27 Sep, by MyPageSEO team". Full history: `GET …/citations/changes?page=&limit=`.
- **Empty state:** `{ available: false, reason: "no_citations_yet" }` → "Our team is setting up your citation tracking." (The list is created when setup completes, then the team checks it.) A list where nothing is checked yet has `health.score: null`: show "Being checked by our team" instead of a score.

**Status labels:** `live_correct` Live & correct · `nap_wrong` Wrong name/address/phone · `not_found` Not listed · `duplicate` Duplicate listing · `submitted` Submitted · `pending` Pending approval · `not_checked` Not checked yet · `removed` Removed.

### 2. Locations list (new 2026-10-08)
`GET /locations` rows have **`citations: { score, grade, nap_wrong } | null`** (null until checked). Add a "Citations" column; `sort=citation_score` sorts by it.

### 3. Location overview (new 2026-10-08)
`GET /locations/:id/overview` has a **`citations`** card: `{ available: true, score, grade, score_change, coverage, listings, counts, last_checked_at }`, or `{ available: false, reason: "no_citations_yet" | "not_checked_yet" }`. Link the card to the Citations page.

### 4. Dashboards
`GET /dashboard`:
- **Business:** a `citations` block (`score`, `grade`, `score_change`, `coverage`, `listings`, `live_correct`, `nap_wrong`, `not_found`, `not_checked`) and `locations[].citation_score`.
- **Agency:** the same block, `portfolio.avg_citation_score` and `table.rows[].citations: { score, grade, nap_wrong }`.
- Not available → `{ available: false, reason: "no_citations_yet" | "not_checked_yet" }`.
- **Recommended actions** with `source: "citations"`: `citations:nap_wrong`, `citations:not_found`. Link them to the location's Citations page.

### 5. Citation Report (Reports center)
- **Create:** `POST /reports { location_id, type: "citation", sections?: ["score","table","nap_issues","changes"], range?: "28d"|"90d"|"12m" }`. PDF, email, share link and monthly schedules (`POST /report-schedules { type: "citation", … }`) work as for the other report types.
- **400 `no_citations_yet`:** disable "Citation Report" for that location and say why.
- **Full report** (`type: "full"`) includes a Citations part automatically.
- **In-app viewer:** `GET /reports/:id` returns the same document blocks as the other types; no special rendering is needed.
- No Google attribution is needed on citation content (it's our own data).

## Don't build
Adding, editing or "check now" for citations, a directory picker for customers, competitor citations, backlinks or authority scores. None exist. If a design needs something that isn't here, ask Mohit to have the backend Claude add it.
