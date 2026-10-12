# Note for the app frontend Claude: make the ranking pages explicit and consistent (2026-10-08)

Paste this into the customer-app frontend session. It covers the **ranking pages** (Rank Tracker, Local Search Grid, Map Ranking), the ranking figures on the **dashboard, locations list and location overview**, the **GBP report's competitor table**, and the **Rank Tracker report** viewer.

---

## Mohit's rule for these pages

**No user should ever have to guess what a number means.**
- Every number is shown with a heading, label or tooltip that says what was measured, where and how.
- When two numbers measure different things, show both, each clearly labelled. Don't hide one, and don't let one stand in for the other.
- A missing number always says **why** it's missing: "not visible in the top 60" is different from "we couldn't get results from Google".

The backend now sends everything you need for this (fields below; shapes in `docs/API.md` "Explicit statuses and scopes on the ranking pages (2026-10-08)"). Please go through the checklist, change what's needed, and **report back** per item: OK / changed (what) / question.

## 1. Missing averages: two different reasons, two different messages

Every average now has `status` and `display`:

| `status` | Means | Show (`display`) | Suggested label / tooltip (`status_text`) |
|---|---|---|---|
| `ok` | a real average rank | `"12.4"` | "Average rank": the average Google Maps position over the points searched; positions below 60 count as 61 |
| `not_found` | Google answered every search, but the business wasn't in the first 60 results at any point | `"60+"` | "Not in the top 60": a visibility problem |
| `no_data` | every search failed; we couldn't get results from Google | `"No data"` | "No data": a temporary problem on our side, measured again at the next refresh. **Never show it as 60+.** |
| `null` | no run yet | – | "Not measured yet" |

The fields:
- **Rank Tracker** (`GET /rank-tracker`): `keywords[].summary[target]`, `groups[].summary[target]`, `overall[target]`, `trend[]`, plus `status_text` with the label and tooltip per status.
- **Grid** (`GET /grid`): `keywords[].summary[target]`, plus `status_text`.
- **Locations list:** `rank.status` / `rank.display`.
- **Overview:** `rankings.overall_status` / `overall_display`, and `trend[].status`.
- **Dashboard:** `avg_rank_status` / `avg_rank_display` on the business locations and agency rows; `key_competitor.status` / `self_status`.

**Cells** already had this: `status: ok | not_found | error`, plus `display` (`"4"`, `"60+"`, `"error"`) and `bucket`. Show `error` cells as a neutral "–" with the tooltip "We couldn't get results from Google for this point", never as 60+.

**The dashboard "competitor ahead" action:** when your average is `no_data`, the backend no longer raises it (it used to say "vs your 60+"). If the dashboard has room, show "Ranking not available yet: we couldn't get results from Google" instead of leaving the slot empty.

## 2. Say what each page measured: use `scope.description`

| Page | `scope` | Example heading or subtitle |
|---|---|---|
| Rank Tracker | `{ kind: "tracker", points: 5, offset_km, description }` | "Measured at 5 points: 100 Queen St E and 1.5 km north, south, east and west of it" |
| Local Search Grid | `{ kind: "grid", points, size, radius_km, description }` | "7×7 grid (49 points) within 8 km of 100 Queen St E" |
| Map Ranking (each keyword) | `{ kind: "point", point, list_depth: 20, description }` | "Google's top 20 at 100 Queen St E" / "Google's top 20 1.5 km north of 100 Queen St E" |

**The two averages are different numbers, so show both, labelled.** The Rank Tracker average (5 points) and the grid average (every grid point) for the same keyword will differ. Label them "Average rank (5 points)" and "Average rank (7×7 grid)", for example.
- The **dashboard, locations list and overview** use the **Rank Tracker** average; say so in their tooltip ("average over the 5 tracking points, all keywords").
- Never compare one with the other, or use one as a fallback for the other.

## 3. Map Ranking is "who ranks **at this point**"

- The list is Google's named top 20 **at one point**. The default point `C` is the business's own address, or the chosen city / ZIP for a service-area business, where a business is usually near the top.
- **Headings:** "Who ranks at {point description}". Never "Who ranks higher than you" or "Your competitors".
- Keep the **point selector** visible (C / N / S / E / W).
- **Two numbers for the client, show both:** each `keywords[]` has `self: { in_list, list_rank, list_depth: 20, tracker_cell }`.
  - "Position in this list: #4" (`list_rank`), or "Not in the top 20 here" when `in_list` is false.
  - "Rank Tracker at this point: 3" (`tracker_cell.display`).
  - Tooltip: "Two separate Google searches made minutes apart; positions can differ by a place or two."
- For "how many businesses outrank you across your area", use the **grid** numbers (the summaries of the businesses you track), not this list.

## 4. Competitors: where each list comes from

| List | Where | What it is | Show rank numbers? |
|---|---|---|---|
| **Your competitors** (tracked) | `targets` with keys `competitor_N` on the ranking pages | Added by the user, max 5. Ranked from the same searches as the business in every cell and summary | **Yes**: the fair head-to-head numbers |
| **Key competitor** | dashboard / overview `key_competitor` | The tracked competitor with the best Rank Tracker average (`name`, `avg_rank` + `status`, `self_avg_rank` + `self_status`, `ahead`) | Yes, with both statuses |
| **GBP report competitor table** | `GET /locations/:id/gbp/report` → `competitors.rows` | The client, then the tracked competitors (`source: "tracking"`), then **up to 3 businesses ranking highest across the latest run's whole grid** (`source: "area"`, new 2026-10-08) | **No**: the GBP report carries no rank numbers by design; it compares public profile facts |

- Label `source: "area"` rows "Top in your area" (tooltip: "Among the businesses ranking highest across your whole grid in the latest ranking run"). Label `tracking` rows "Your competitor".
- `source: "map_list"` appears only on reports built from older runs. Label it "Nearby business".

**Adding competitors (please make this easy to find):**
- **Suggestions:** `GET /locations/:id/competitor-suggestions`.
- **Search:** `GET /places/search?q=&locationId=`.
- **Save:** `PUT /locations/:id/tracking { competitors: [place_id, …] }`, max 5. The response carries their names (`competitors`).
- Offer "Track this competitor" wherever a non-tracked business is listed: Map Ranking rows, GBP report "Top in your area" rows, suggestions.

## 5. Change arrows and labels

- `change = previous − current`: **positive = improved** (the rank number went down). Green / up arrow / "+2 improved".
- `changeLabel`:
  - `improved`, `declined`, `unchanged`: show the number.
  - `entered_top_60`, `dropped_out_of_top_60`: `change` is `null`; show the words, not "+0" or "–".
  - `null`: show nothing, or "New keyword" when the keyword wasn't in the previous run.
- **Overall change:** show it with its basis, e.g. "+2.1 (on 3 of 5 keywords)" from `comparable_keywords` / `keywords_total`. Show no change when `comparable_keywords` is 0, with the tooltip "No keyword was measured in both runs".
- **Percentages:** `foundRate` and `top3Rate` are 0–1; multiply by 100 once. Label them "In the top 60 at x% of points" and "In the top 3 at x% of points".

## 6. The run, and the centre

- **The run:** every ranking page shows the latest done/partial run unless `?runId=` is passed. If the user picks an older run, every ranking page and header uses the same `runId`. Show "Measured on {run.run_at}".
- **Partial runs:** `status: "partial"` shows "Some searches failed in this run; those points show '–'".
- **The centre:** `run.center.source` is `place` or `manual`. When it's `manual` (a service-area business centred on a city / ZIP), wording like "at your business" becomes "around {run.center.label}".

## 7. Rank Tracker report (PDF / in-app viewer)

`GET /reports/:id` returns the document blocks the PDF is drawn from.

**Check:**
- The viewer shows the same sections, headings and numbers as the PDF.
- For the same run, the report and the ranking pages agree. If anything disagrees, send us the run id and the two figures.

## How to report back

Reply with each section (1–7): OK / changed (what) / question, and screenshots or exact figures for anything that still disagrees for the same run.
