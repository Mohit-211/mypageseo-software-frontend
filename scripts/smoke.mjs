#!/usr/bin/env node
/**
 * Smoke test: loads every route and reports page crashes / console errors.
 *
 * Setup (once):  npm i -D playwright && npx playwright install chromium
 * Run:           npm run dev   (in another terminal)
 *                node scripts/smoke.mjs [baseUrl]     default http://localhost:5173
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:5173";
const L = "/locations/loc_riverside_north";

// { url } = visit directly; { from, match } = open list page, follow first link matching regex
const ROUTES = [
  { url: "/" }, { url: "/dashboard" },
  { url: "/locations" }, { url: "/locations/add" },
  { url: L }, { url: `${L}/reports` },
  { url: `${L}/gbp` }, { url: `${L}/gbp/posts` }, { url: `${L}/gbp/reviews` },
  { url: `${L}/gbp/audit` }, { url: `${L}/gbp/audit/competitors` },
  { url: `${L}/rankings` }, { url: `${L}/rankings/keywords` }, { url: `${L}/rankings/groups` },
  { url: `${L}/rankings/grid` }, { url: `${L}/rankings/map` }, { url: `${L}/rankings/competitors` },
  { url: `${L}/citations` }, { from: `${L}/citations`, match: /\/citations\/[^/?#]+$/ },
  { url: `${L}/competitors` }, { from: `${L}/competitors`, match: /\/competitors\/[^/?#]+$/ },
  { url: "/rankings" }, { url: "/rankings/keywords" }, { url: "/rankings/keyword-groups" },
  { url: "/rankings/map-rankings" }, { url: "/rankings/local-search-grid" },
  { url: "/gbp" }, { url: "/gbp/audit" }, { url: "/gbp/reviews" }, { url: "/gbp/posts" },
  { url: "/citations" }, { url: "/competitors" },
  { url: "/reports" }, { url: "/reports/create" }, { url: "/reports/scheduled" },
  { from: "/reports", match: /^\/reports\/(?!create|scheduled)[^/?#]+$/ },
  { url: "/clients" }, { url: "/clients/cl_riverside" },
  { url: "/clients/cl_riverside/locations" }, { url: "/clients/cl_riverside/users" },
  { url: "/automations" }, { url: "/automations/create" },
  { from: "/automations", match: /^\/automations\/(?!create)[^/?#]+$/ },
  { url: "/settings" }, { url: "/settings/profile" }, { url: "/settings/billing" },
  { url: "/settings/team" }, { url: "/settings/integrations" },
  { url: "/settings/notifications" }, { url: "/settings/white-label" },
  { url: "/notifications" }, { url: "/help" },
  { url: "/onboarding" }, { url: "/onboarding/business" }, { url: "/onboarding/agency" },
  { url: "/login" }, { url: "/signup" }, { url: "/forgot-password" },
  { url: "/reset-password?token=test" }, { url: "/verify-email?token=test" },
  { url: "/403" }, { url: "/404" }, { url: "/does-not-exist" },
];

const browser = await chromium.launch();
const context = await browser.newContext();
const results = [];

for (const route of ROUTES) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

  let target = route.url;
  try {
    if (route.from) {
      await page.goto(BASE + route.from, { waitUntil: "networkidle" });
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      target = hrefs.find((h) => h && route.match.test(h));
      if (!target) { results.push({ url: `${route.from} → (detail)`, status: "SKIP", errors: ["no matching link found"] }); await page.close(); continue; }
      errors.length = 0;
    }
    await page.goto(BASE + target, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const crashed = await page.locator("text=/something went wrong|unexpected application error/i").count();
    if (crashed) errors.push("error boundary rendered");
  } catch (e) {
    errors.push(`navigation: ${e.message.split("\n")[0]}`);
  }
  results.push({ url: target, status: errors.length ? "FAIL" : "ok", errors });
  await page.close();
}
await browser.close();

for (const r of results) {
  console.log(`${r.status.padEnd(4)}  ${r.url}`);
  for (const e of r.errors) console.log(`        ${e.slice(0, 300)}`);
}
const failed = results.filter((r) => r.status === "FAIL").length;
console.log(`\n${results.length} routes, ${failed} failed, ${results.filter((r) => r.status === "SKIP").length} skipped`);
process.exit(failed ? 1 : 0);
