#!/usr/bin/env node
/**
 * Generates src/pages/** and src/app/router.tsx from the old TanStack routes.
 *
 * Usage (from mypageseo-frontend/):
 *   node scripts/generate-pages.mjs ../local_navigator/src/routes
 *
 * Overwrites generated files. Prints a report of anything needing manual work.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const OLD_DIR = process.argv[2];
if (!OLD_DIR || !fs.existsSync(OLD_DIR)) {
  console.error("Usage: node scripts/generate-pages.mjs <old src/routes dir>");
  process.exit(1);
}
const ROOT = process.cwd();
const PAGES = path.join(ROOT, "src/pages");

// old route file -> new file (relative to src/pages)
const MAP = {
  "index.tsx": "home/HomePage.tsx",
  "dashboard.tsx": "dashboard/DashboardPage.tsx",
  "locations.tsx": "locations/LocationsLayout.tsx",
  "locations.index.tsx": "locations/LocationsIndexPage.tsx",
  "locations.add.tsx": "locations/LocationsAddPage.tsx",
  "locations.$locationId.index.tsx": "locations/location-detail/LocationDetailIndexPage.tsx",
  "locations.$locationId.reports.tsx": "locations/location-detail/LocationReportsPage.tsx",
  "locations.$locationId.gbp.tsx": "locations/location-detail/gbp/GbpLayout.tsx",
  "locations.$locationId.gbp.index.tsx": "locations/location-detail/gbp/GbpIndexPage.tsx",
  "locations.$locationId.gbp.posts.tsx": "locations/location-detail/gbp/GbpPostsPage.tsx",
  "locations.$locationId.gbp.reviews.tsx": "locations/location-detail/gbp/GbpReviewsPage.tsx",
  "locations.$locationId.gbp.audit.tsx": "locations/location-detail/gbp/audit/GbpAuditLayout.tsx",
  "locations.$locationId.gbp.audit.index.tsx": "locations/location-detail/gbp/audit/GbpAuditIndexPage.tsx",
  "locations.$locationId.gbp.audit.competitors.tsx": "locations/location-detail/gbp/audit/GbpAuditCompetitorsPage.tsx",
  "locations.$locationId.rankings.tsx": "locations/location-detail/rankings/RankingsLayout.tsx",
  "locations.$locationId.rankings.index.tsx": "locations/location-detail/rankings/RankingsIndexPage.tsx",
  "locations.$locationId.rankings.keywords.tsx": "locations/location-detail/rankings/RankingsKeywordsPage.tsx",
  "locations.$locationId.rankings.groups.tsx": "locations/location-detail/rankings/RankingsGroupsPage.tsx",
  "locations.$locationId.rankings.grid.tsx": "locations/location-detail/rankings/RankingsGridPage.tsx",
  "locations.$locationId.rankings.map.tsx": "locations/location-detail/rankings/RankingsMapPage.tsx",
  "locations.$locationId.rankings.competitors.tsx": "locations/location-detail/rankings/RankingsCompetitorsPage.tsx",
  "locations.$locationId.citations.index.tsx": "locations/location-detail/citations/CitationsIndexPage.tsx",
  "locations.$locationId.citations.$citationId.tsx": "locations/location-detail/citations/CitationDetailPage.tsx",
  "locations.$locationId.competitors.index.tsx": "locations/location-detail/competitors/CompetitorsIndexPage.tsx",
  "locations.$locationId.competitors.$competitorId.tsx": "locations/location-detail/competitors/CompetitorDetailPage.tsx",
  "rankings.index.tsx": "rankings/RankingsIndexPage.tsx",
  "rankings.keywords.tsx": "rankings/RankingsKeywordsPage.tsx",
  "rankings.keyword-groups.tsx": "rankings/RankingsKeywordGroupsPage.tsx",
  "rankings.map-rankings.tsx": "rankings/RankingsMapRankingsPage.tsx",
  "rankings.local-search-grid.tsx": "rankings/RankingsLocalSearchGridPage.tsx",
  "gbp.index.tsx": "gbp/GbpIndexPage.tsx",
  "gbp.audit.tsx": "gbp/GbpAuditPage.tsx",
  "gbp.reviews.tsx": "gbp/GbpReviewsPage.tsx",
  "gbp.posts.tsx": "gbp/GbpPostsPage.tsx",
  "citations.tsx": "citations/CitationsPage.tsx",
  "competitors.tsx": "competitors/CompetitorsPage.tsx",
  "reports.index.tsx": "reports/ReportsIndexPage.tsx",
  "reports.create.tsx": "reports/ReportsCreatePage.tsx",
  "reports.scheduled.tsx": "reports/ReportsScheduledPage.tsx",
  "reports.$reportId.tsx": "reports/ReportDetailPage.tsx",
  "clients.index.tsx": "clients/ClientsIndexPage.tsx",
  "clients.$clientId.tsx": "clients/client-detail/ClientLayout.tsx",
  "clients.$clientId.index.tsx": "clients/client-detail/ClientIndexPage.tsx",
  "clients.$clientId.locations.tsx": "clients/client-detail/ClientLocationsPage.tsx",
  "clients.$clientId.users.tsx": "clients/client-detail/ClientUsersPage.tsx",
  "automations.index.tsx": "automations/AutomationsIndexPage.tsx",
  "automations.create.tsx": "automations/AutomationsCreatePage.tsx",
  "automations.$automationId.tsx": "automations/AutomationDetailPage.tsx",
  "settings.tsx": "settings/SettingsLayout.tsx",
  "settings.index.tsx": "settings/SettingsIndexPage.tsx",
  "settings.profile.tsx": "settings/SettingsProfilePage.tsx",
  "settings.billing.tsx": "settings/SettingsBillingPage.tsx",
  "settings.team.tsx": "settings/SettingsTeamPage.tsx",
  "settings.integrations.tsx": "settings/SettingsIntegrationsPage.tsx",
  "settings.notifications.tsx": "settings/SettingsNotificationsPage.tsx",
  "settings.white-label.tsx": "settings/SettingsWhiteLabelPage.tsx",
  "notifications.tsx": "notifications/NotificationsPage.tsx",
  "help.tsx": "help/HelpPage.tsx",
  "onboarding.index.tsx": "onboarding/OnboardingIndexPage.tsx",
  "onboarding.business.tsx": "onboarding/OnboardingBusinessPage.tsx",
  "onboarding.agency.tsx": "onboarding/OnboardingAgencyPage.tsx",
  "login.tsx": "auth/LoginPage.tsx",
  "signup.tsx": "auth/SignupPage.tsx",
  "forgot-password.tsx": "auth/ForgotPasswordPage.tsx",
  "reset-password.tsx": "auth/ResetPasswordPage.tsx",
  "verify-email.tsx": "auth/VerifyEmailPage.tsx",
  "403.tsx": "errors/ForbiddenPage.tsx",
  "404.tsx": "errors/NotFoundPage.tsx",
};

const report = [];
const warn = (file, msg) => report.push(`${file}: ${msg}`);

// ---------- tiny balanced-bracket scanner ----------
const PAIRS = { "(": ")", "{": "}", "[": "]" };
function skipQuote(s, i) {
  const q = s[i++];
  while (i < s.length) {
    if (s[i] === "\\") { i += 2; continue; }
    if (s[i] === q) return i + 1;
    i++;
  }
  return i;
}
function skipTemplate(s, i) {
  i++;
  while (i < s.length) {
    if (s[i] === "\\") { i += 2; continue; }
    if (s[i] === "`") return i + 1;
    if (s[i] === "$" && s[i + 1] === "{") { i = matchClose(s, i + 1) + 1; continue; }
    i++;
  }
  return i;
}
function matchClose(s, open) {
  const stack = [PAIRS[s[open]]];
  let i = open + 1;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'") { i = skipQuote(s, i); continue; }
    if (c === "`") { i = skipTemplate(s, i); continue; }
    if (c === "/" && s[i + 1] === "/") { const n = s.indexOf("\n", i); i = n < 0 ? s.length : n; continue; }
    if (c === "/" && s[i + 1] === "*") { i = s.indexOf("*/", i) + 2; continue; }
    if (PAIRS[c]) stack.push(PAIRS[c]);
    else if (c === ")" || c === "}" || c === "]") {
      if (stack.pop() !== c) throw new Error(`bracket mismatch at ${i}`);
      if (!stack.length) return i;
    }
    i++;
  }
  throw new Error("unbalanced brackets");
}
/** Split the inside of an object literal into top-level { key, value } entries. */
function splitProps(inner) {
  const parts = [];
  let depth = 0, start = 0, i = 0;
  while (i < inner.length) {
    const c = inner[i];
    if (c === '"' || c === "'") { i = skipQuote(inner, i); continue; }
    if (c === "`") { i = skipTemplate(inner, i); continue; }
    if (PAIRS[c]) depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) { parts.push(inner.slice(start, i)); start = i + 1; }
    i++;
  }
  parts.push(inner.slice(start));
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^(\w+)\s*:\s*([\s\S]*)$/);
      return m ? { key: m[1], value: m[2].trim() } : { key: p, value: p };
    });
}

// ---------- per-file conversion ----------
function convert(oldName, src, fallbackName) {
  const paramKeys = [...oldName.matchAll(/\$(\w+)/g)].map((m) => m[1]);
  let componentName = null;
  let schema = null;

  // 1. Remove `export const Route = createFileRoute(...)({...});`
  const m = /export const Route = createFileRoute\(/.exec(src);
  if (!m) {
    warn(oldName, "no createFileRoute found — copied with codemod only");
  } else {
    const firstOpen = m.index + m[0].length - 1;
    const firstClose = matchClose(src, firstOpen);
    const secondOpen = src.indexOf("(", firstClose);
    const secondClose = matchClose(src, secondOpen);
    let end = secondClose + 1;
    if (src[end] === ";") end++;
    const argText = src.slice(secondOpen + 1, secondClose).trim();
    const props = argText.startsWith("{") ? splitProps(argText.slice(1, -1)) : [];
    let replacement = "";
    for (const { key, value } of props) {
      if (key === "head") continue;
      if (key === "component") {
        if (/^\w+$/.test(value)) componentName = value;
        else { componentName = fallbackName; replacement = `const ${fallbackName} = ${value};`; }
      } else if (key === "validateSearch") {
        if (/^\w+$/.test(value)) schema = value;
        else schema = (value.match(/(\w+)\.safeParse/) || [])[1] ?? null;
        if (!schema) warn(oldName, "validateSearch present but schema name not found");
      } else {
        warn(oldName, `route option "${key}" dropped — needs manual port`);
      }
    }
    if (!componentName) warn(oldName, "no component option found");
    src = src.slice(0, m.index) + replacement + src.slice(end);
  }

  const needs = new Set();

  // 2. Params
  if (/Route\.useParams\(\)|\buseParams\(\{[^)]*\}\)/.test(src)) {
    const call = `useRequiredParams(${paramKeys.map((k) => JSON.stringify(k)).join(", ")})`;
    src = src.replace(/Route\.useParams\(\)/g, call).replace(/\buseParams\(\{[^)]*\}\)/g, call);
    needs.add("params");
  }

  // 3. Search
  if (/Route\.useSearch\(\)/.test(src)) {
    if (!schema) warn(oldName, "Route.useSearch() used without a validateSearch schema");
    const s = schema ?? "searchSchema";
    src = src.replace(
      /const\s+(\w+|\{[^}]*\})\s*=\s*Route\.useSearch\(\);/g,
      (_, lhs) => `const [${lhs.trim()}, setSearch] = useTypedSearch(${s});`,
    );
    if (/Route\.useSearch\(\)/.test(src)) {
      src = src.replace(/Route\.useSearch\(\)/g, `useTypedSearch(${s})[0]`);
      warn(oldName, "Route.useSearch() in unusual form — used [0], check setSearch availability");
    }
    needs.add("search");
  }

  // 4. useNavigate({ from }) -> useNavigate()
  src = src.replace(/useNavigate\(\{[^)]*\}\)/g, "useNavigate()");

  // 5. navigate({ search, replace? }) -> setSearch(search, { replace })
  let idx = 0;
  while ((idx = src.indexOf("navigate(", idx)) !== -1) {
    if (/[\w.]/.test(src[idx - 1] ?? "")) { idx += 9; continue; }
    const open = idx + "navigate".length;
    let close;
    try { close = matchClose(src, open); } catch { idx = open; continue; }
    const arg = src.slice(open + 1, close).trim();
    if (arg.startsWith("{")) {
      const props = splitProps(arg.slice(1, -1));
      const keys = props.map((p) => p.key);
      if (keys.includes("search")) {
        const extra = keys.filter((k) => k !== "search" && k !== "replace");
        if (extra.length === 0) {
          const searchVal = props.find((p) => p.key === "search").value;
          const rep = props.find((p) => p.key === "replace");
          const call = `setSearch(${searchVal}${rep ? `, { replace: ${rep.value} }` : ""})`;
          if (!needs.has("search")) warn(oldName, "navigate({ search }) without Route.useSearch() — setSearch undefined");
          src = src.slice(0, idx) + call + src.slice(close + 1);
          idx += call.length;
          continue;
        }
        warn(oldName, `navigate with search + ${extra.join("/")} — convert manually`);
      }
    }
    idx = close;
  }

  // 6. Drop createFileRoute from the router import
  src = src.replace(/import\s*\{([^}]*)\}\s*from\s*"@tanstack\/react-router";?\n?/g, (full, names) => {
    const kept = names.split(",").map((n) => n.trim()).filter((n) => n && n !== "createFileRoute");
    return kept.length ? `import { ${kept.join(", ")} } from "@tanstack/react-router";\n` : "";
  });

  // 7. Add hook imports after the last import
  const extraImports = [];
  if (needs.has("search")) extraImports.push(`import { useTypedSearch } from "@/hooks/use-typed-search";`);
  if (needs.has("params")) extraImports.push(`import { useRequiredParams } from "@/hooks/use-required-params";`);
  if (extraImports.length) {
    const re = /^import\s[\s\S]*?from\s*["'][^"']+["'];?[ \t]*$/gm;
    let last = null, mm;
    while ((mm = re.exec(src))) last = mm;
    const at = last ? last.index + last[0].length : 0;
    src = src.slice(0, at) + (at ? "\n" : "") + extraImports.join("\n") + (at ? "" : "\n") + src.slice(at);
  }

  // 8. Leftover checks
  if (/\bRoute\./.test(src)) warn(oldName, "remaining Route.* reference");
  if (/\bsearch=\{/.test(src)) warn(oldName, "<Link search={...}> — convert to query string manually");
  if (/\b(redirect|notFound)\(/.test(src)) warn(oldName, "redirect()/notFound() call — port manually");

  if (componentName) src = src.trimEnd() + `\n\nexport default ${componentName};\n`;
  return src;
}

// ---------- run conversions ----------
const oldFiles = fs.readdirSync(OLD_DIR).filter((f) => f.endsWith(".tsx") && f !== "__root.tsx");
for (const f of oldFiles) if (!MAP[f]) warn(f, "not in mapping table — skipped");

const written = [];
for (const [oldName, rel] of Object.entries(MAP)) {
  const oldPath = path.join(OLD_DIR, oldName);
  if (!fs.existsSync(oldPath)) { warn(oldName, "old file missing — skipped"); continue; }
  let out;
  try { out = convert(oldName, fs.readFileSync(oldPath, "utf8"), path.basename(rel, ".tsx")); }
  catch (e) { warn(oldName, `conversion failed (${e.message}) — port manually`); continue; }
  const dest = path.join(PAGES, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  written.push(dest);
}
execFileSync("perl", [path.join(ROOT, "scripts/tanstack-to-rr.pl"), ...written], { stdio: "inherit" });

// ---------- router tree (TanStack flat-file nesting rules) ----------
const keyOf = (f) => f.replace(/\.tsx$/, "").split(".");
const entries = Object.keys(MAP)
  .filter((f) => fs.existsSync(path.join(OLD_DIR, f)))
  .map((f) => {
    const segs = keyOf(f);
    const isIndex = segs[segs.length - 1] === "index";
    return { file: f, segs: isIndex ? segs.slice(0, -1) : segs, isIndex, children: [] };
  });
const layoutKeys = new Set(
  entries
    .filter((e) => !e.isIndex && entries.some((o) => o !== e && o.segs.length > e.segs.length && e.segs.every((s, i) => o.segs[i] === s)))
    .map((e) => e.segs.join(".")),
);
const layouts = new Map(entries.filter((e) => !e.isIndex && layoutKeys.has(e.segs.join("."))).map((e) => [e.segs.join("."), e]));
const root = { children: [] };
for (const e of entries) {
  let parent = root, parentLen = 0;
  const maxLen = e.isIndex ? e.segs.length : e.segs.length - 1;
  for (let n = maxLen; n > 0; n--) {
    const k = e.segs.slice(0, n).join(".");
    if (layouts.has(k) && layouts.get(k) !== e) { parent = layouts.get(k); parentLen = n; break; }
  }
  e.rel = e.segs.slice(parentLen).map((s) => (s.startsWith("$") ? `:${s.slice(1)}` : s)).join("/");
  parent.children.push(e);
}

// import names (disambiguate duplicates)
const baseName = (f) => path.basename(MAP[f], ".tsx");
const counts = {};
for (const e of entries) counts[baseName(e.file)] = (counts[baseName(e.file)] ?? 0) + 1;
for (const e of entries) {
  const b = baseName(e.file);
  e.ident = counts[b] > 1 && MAP[e.file].startsWith("locations/location-detail/") ? `Location${b}` : b;
}

function emit(nodes, indent) {
  const pad = " ".repeat(indent);
  return nodes
    .map((n) => {
      const head = n.isIndex && !n.rel ? "index: true" : `path: ${JSON.stringify(n.rel)}`;
      if (n.children.length) {
        return `${pad}{\n${pad}  ${head},\n${pad}  Component: ${n.ident},\n${pad}  children: [\n${emit(n.children, indent + 4)}\n${pad}  ],\n${pad}},`;
      }
      return `${pad}{ ${head}, Component: ${n.ident} },`;
    })
    .join("\n");
}

const notFound = entries.find((e) => e.file === "404.tsx");
const imports = entries.map((e) => `import ${e.ident} from "@/pages/${MAP[e.file].replace(/\.tsx$/, "")}";`).join("\n");
const router = `// GENERATED by scripts/generate-pages.mjs from the old TanStack route files.
// Nesting mirrors TanStack's flat-file rules. Safe to hand-edit from here on.
import { createBrowserRouter } from "react-router-dom";
import { AppRoot, RootErrorBoundary } from "./App";
${imports}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppRoot,
    ErrorBoundary: RootErrorBoundary,
    children: [
${emit(root.children, 6)}${notFound ? `\n      { path: "*", Component: ${notFound.ident} },` : ""}
    ],
  },
]);

export default router;
`;
fs.writeFileSync(path.join(ROOT, "src/app/router.tsx"), router);

console.log(`\nWrote ${written.length} pages + src/app/router.tsx`);
console.log(report.length ? `\n== NEEDS MANUAL ATTENTION (${report.length}) ==\n${report.join("\n")}` : "\n== Nothing needs manual attention ==");
