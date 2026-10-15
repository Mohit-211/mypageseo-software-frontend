# Note for the backend: the white-label client page as a frontend bundle (Phase 23)

**Date:** 2026-10-16. **From:** the frontend. **Needs from the backend:** two endpoints, the CSP and nginx changes below.

## Reply, 2026-10-16 (after `CUSTOMER_APP.md` "The client page's data and logo")

**Tested against the local API** (`npm run dev` on port 5055, with one link made by `whiteLabelLinkService.upsert` for the demo agency's Maple Leaf Plumbing & Heating):
- **`/data` (#242):** the shape matches `src/client-page/types.ts` exactly, and the raw JSON is read as it is. Every tab with data renders (Rankings, Competitors, Listings), with no console errors.
- **`/logo` (#243)** and **`/pdf/rank_tracker`** both return 200.
- **Unknown token:** `/data` answers 404 `{ "error": "not_available" }`, and the page shows "Report not available".
- **Requests:** the page made no request to any host but its own.

**Fonts:** bundled as you asked (`@fontsource/ibm-plex-sans`, served from `/_c/assets/`). **Please change the CSP** in OPERATIONS.md: `font-src 'self'` instead of `font-src https://fonts.gstatic.com`, and drop `https://fonts.googleapis.com` from `style-src`. With the current CSP the fonts would be blocked and the page would fall back to the system font. Section 5 below has the updated CSP.

**Views in development:** in `npm run dev:client`, React's StrictMode runs effects twice, so one page open calls `/data` twice and counts 2 views. A production build calls it once.

**Small data note:** `nap_issues.expected.phone` arrives as `4165550100` while `found` is formatted (`(416) 555-0199`). The page shows both as they come. If the expected value could be formatted the same way, the comparison would read better.

## What changed

The client page behind a white-label link (`link.url`) will be a small React page, not the server-rendered HTML from `renderWhiteLabelPage`. It reuses the customer app's components and looks like the dashboard: the rank grid as a board you can hover, trend and performance charts, the profile score, competitor and review blocks. It also adds plain-language explanations and tabs per report.

- **Source:** `client.html` and `src/client-page/` in the frontend repo, with its own Vite config (`vite.client.config.ts`).
- **Build:** `npm run build:client` writes static files to `dist-client/`: `client.html` and `assets/*`. Asset URLs start with `/_c/`.
- **Page addresses stay the same:** `/<token>` on the neutral domain and `/w/<token>` on the API host. The page makes every call relative to its own path, so the same build works on both hosts.
- **No product branding:** nothing in the bundle says MyPageSEO (checked on every build). The Google Maps attribution still shows.

The frontend is done and type-checks, lints and builds. It runs at `npm run dev:client` → `http://localhost:3001/demo` with sample data. **It has not been run against the backend yet**, because the data endpoint doesn't exist.

## 1. New: `GET /w/:token/data?e=<key>` (and `/:token/data` on a white-label host)

This returns JSON with everything the page shows. Use the same access rules, the same neutral **404** (unknown, rotated or revoked link, organization not an agency, no `white_label`, billing inactive or suspended, unknown edition) and the same **429** (60 / minute / IP) as #240. Send `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store`. The response must contain no internal ids.

```json
{
  "branding": {
    "name": "Northern Local SEO",
    "website_url": "https://northernlocalseo.example",
    "contact_text": "hello@northernlocalseo.example · (416) 555-0199",
    "footer_text": "Northern Local SEO · Toronto, ON",
    "primary_color": "#0f766e",
    "secondary_color": "#b45309",
    "logo_url": "./3q2V8kXb0Jt1yLwZp9aR4A/logo"
  },
  "location": { "name": "Maple Leaf Dental", "address": "120 King St W", "city": "Toronto", "state": "ON", "country": "Canada" },
  "edition": { "key": "20261003-0302", "generated_at": "2026-10-03T03:02:40.000Z" },
  "latest_key": "20261003-0302",
  "editions": [{ "key": "20261003-0302", "generated_at": "…" }, { "key": "20260903-0301", "generated_at": "…" }],
  "reports": ["rank_tracker", "gbp_audit", "competitor_analysis", "citation", "reputation"],
  "data": { "rank_tracker": { "available": true, "…": "…" }, "gbp_audit": { "…": "…" } },
  "attribution": "Business names, ratings and reviews: Google Maps"
}
```

- **`branding`:** the live branding, the same one the HTML page uses today: settings plus `branding_override`, with empty override fields falling back. `logo_url` is `null` without a logo. It is relative to the page (`./<token>/logo`), the same trick the HTML page uses for its links.
- **`edition`:** the edition being shown, either the newest or the one named by `?e=<key>`.
- **`editions`:** newest first, at most 50, without `trigger`.
- **`reports`:** the link's selected types that have data in this edition, in display order. A selected type with `{ available: false }` is left out, as the HTML page does today.
- **`data[type]`:** `edition.data[type]` exactly as stored (the `SnapshotData` shapes in `reports.types.ts`). The page reads every field in `RankTrackerData`, `GbpAuditData`, `CompetitorData`, `CitationReportData` and `ReputationReportData`. The frontend copy of these types is in `src/client-page/types.ts`; if a shape changes, please update it there too or tell us.
- **`attribution`:** the same text the HTML page puts in its footer when Places content is shown, otherwise `null`.
- **Views:** count them here instead of on the HTML page. The page calls `/data` once when it opens and once each time the client opens an earlier version.

## 2. New: `GET /w/:token/logo` (and `/:token/logo`)

This returns the logo image the page shows (override logo first, then the settings logo), with its `Content-Type`. It's a **404** without a logo, plus the same link checks as above. `Cache-Control: private, max-age=300` is fine, because the branding is live.

## 3. Unchanged

`GET /w/:token/pdf/:type?e=<key>` (#241) stays as it is. The page links to `./<token>/pdf/<type>` for each report, with `?e=` added for an older version.

## 4. Serving the page (nginx)

The same rules apply on the neutral domain (`/:token…`) and on the API host (`/w/:token…`, until the domain is chosen):

| Request | Served by |
|---|---|
| `/_c/*` | static files from `dist-client/` (`/_c/assets/x.js` → `dist-client/assets/x.js`); long cache, the filenames are hashed |
| `/<token>` or `/w/<token>` (one path segment of `[A-Za-z0-9_-]`, no extension) | `dist-client/client.html`, `Cache-Control: no-cache` |
| `…/<token>/data`, `…/<token>/logo`, `…/<token>/pdf/*` | the API (as #240/#241 are today) |

Sketch for the API host:

```nginx
location ^~ /_c/ { alias /var/www/client-page/; expires 1y; add_header Cache-Control "public, immutable"; }
location ~ ^/w/[A-Za-z0-9_-]+/?$ { root /var/www/client-page; try_files /client.html =404; add_header Cache-Control "no-cache"; }
location /w/ { proxy_pass http://127.0.0.1:<port>; }   # data, logo, pdf
```

An unknown token still gets `client.html`. The page then calls `/data`, receives the 404 and shows the neutral "Report not available" message. The HTML status is 200, and `noindex` stays on.

## 5. Headers for `client.html`

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
X-Robots-Tag: noindex, nofollow, noarchive
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```

- **Scripts:** this replaces today's `default-src 'none'` for the page only. Scripts come from the same origin, with no third-party scripts.
- **Fonts:** bundled with the page (since 2026-10-16), so `font-src 'self'` and no Google hosts.
- **Inline styles:** `'unsafe-inline'` covers the inline style attributes that the UI primitives and charts set.

## 6. The current HTML renderer

Once the page is live, `renderWhiteLabelPage` is no longer used for `/w/:token`. Keep `renderWhiteLabelNotFound` / `TooMany` for the JSON endpoint's failures if you like; the page doesn't read their HTML. The PDF renderer is unaffected.

## Questions

1. **Logo route:** is `GET /w/:token/logo` fine, or would you rather embed the logo in `/data` as a `data:` URI, as the HTML page does? A separate route keeps `/data` small and lets the browser cache the logo.
2. **Map points:** `map_ranking[].points[].point` is shown as "Your business / North / East / South / West" for `C/N/E/S/W`. Are there other values?
3. **Daily performance dates:** `by_day[].date` is read as `YYYY-MM-DD`, and `keywords.latest_month` as `YYYY-MM`. Please confirm.
