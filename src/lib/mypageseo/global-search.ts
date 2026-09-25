/**
 * Global search index for the application header.
 *
 * The search backend is not connected to this frontend, so the index is built
 * from the same records every screen renders: workspace locations and clients
 * plus the canonical demo keyword, competitor, citation and report data. When
 * real reads land, replace `buildSearchIndex` with the backend search response;
 * the result shape and the screens consuming it stay the same.
 */

import { withDemoFallback } from "./demo/demo-mode";
import { DEMO_CLIENTS, DEMO_LOCATIONS, demoCompetitors, demoKeywords } from "./demo/entities";
import { demoCitations } from "./demo/citations";
import { demoReportRows } from "./demo/reports";
import { primaryNavigation, type AccountType } from "./navigation";

export type SearchGroupId =
  "locations" | "clients" | "keywords" | "reports" | "competitors" | "citations" | "pages";

export const SEARCH_GROUP_LABELS: Record<SearchGroupId, string> = {
  locations: "Locations",
  clients: "Clients",
  keywords: "Keywords",
  reports: "Reports",
  competitors: "Competitors",
  citations: "Citations",
  pages: "Pages",
};

/** Order groups are rendered in. */
const GROUP_ORDER: SearchGroupId[] = [
  "locations",
  "clients",
  "keywords",
  "competitors",
  "citations",
  "reports",
  "pages",
];

export type SearchTarget =
  | { kind: "location"; locationId: string }
  | { kind: "keywords"; locationId: string }
  | { kind: "competitor"; locationId: string; competitorId: string }
  | { kind: "citation"; locationId: string; citationId: string }
  | { kind: "report"; reportId: string }
  | { kind: "client"; clientId: string }
  | { kind: "page"; to: string };

export type SearchResult = {
  id: string;
  group: SearchGroupId;
  title: string;
  /** Short qualifier that distinguishes similar records. */
  context: string | null;
  /** Secondary detail such as a state or a metric already shown elsewhere. */
  meta: string | null;
  target: SearchTarget;
  /** Location this record belongs to, so selection can set workspace context. */
  locationId: string | null;
  /** Extra text matched against, never displayed. */
  haystack: string;
};

export type SearchScope = {
  accountType: AccountType;
  /** Agency only: limits results to one client when a client is selected. */
  activeClientId: string | null;
};

const BUSINESS_CLIENT_ID = "cl_riverside";

function scopedLocations(scope: SearchScope) {
  if (scope.accountType === "business") {
    return DEMO_LOCATIONS.filter((l) => l.clientId === BUSINESS_CLIENT_ID);
  }
  if (scope.activeClientId) {
    return DEMO_LOCATIONS.filter((l) => l.clientId === scope.activeClientId);
  }
  return DEMO_LOCATIONS;
}

function clientName(clientId: string): string {
  return DEMO_CLIENTS.find((c) => c.id === clientId)?.name ?? clientId;
}

let cache: { key: string; entries: SearchResult[] } | null = null;

/**
 * Everything the signed-in account is allowed to search, flattened once.
 *
 * `real` is the seam for the search backend: when it returns results they are
 * authoritative and the demo index below is never built.
 */
export function buildSearchIndex(scope: SearchScope, real?: SearchResult[] | null): SearchResult[] {
  if (real) return real;
  return withDemoFallback(real, () => demoSearchIndex(scope));
}

function demoSearchIndex(scope: SearchScope): SearchResult[] {
  const key = `${scope.accountType}:${scope.activeClientId ?? "all"}`;
  if (cache?.key === key) return cache.entries;

  const locations = scopedLocations(scope);
  const allowed = new Set(locations.map((l) => l.id));
  const entries: SearchResult[] = [];

  for (const location of locations) {
    const owner = scope.accountType === "agency" ? clientName(location.clientId) : null;
    entries.push({
      id: `loc:${location.id}`,
      group: "locations",
      title: location.businessName,
      context: location.area,
      meta: owner,
      target: { kind: "location", locationId: location.id },
      locationId: location.id,
      haystack: `${location.street} ${location.postalCode} ${location.primaryCategory} ${owner ?? ""}`,
    });

    for (const keyword of demoKeywords(location.id)) {
      entries.push({
        id: `kw:${keyword.id}`,
        group: "keywords",
        title: keyword.keyword,
        context: location.businessName,
        meta:
          keyword.currentPosition === null ? "Not in top 60" : `Rank ${keyword.currentPosition}`,
        target: { kind: "keywords", locationId: location.id },
        locationId: location.id,
        haystack: `${keyword.group} ${location.area}`,
      });
    }

    for (const competitor of demoCompetitors(location.id)) {
      entries.push({
        id: `cmp:${competitor.id}`,
        group: "competitors",
        title: competitor.name,
        context: location.businessName,
        meta: `Avg. rank ${competitor.averageRank}`,
        target: {
          kind: "competitor",
          locationId: location.id,
          competitorId: competitor.id,
        },
        locationId: location.id,
        haystack: `${competitor.primaryCategory} ${competitor.website}`,
      });
    }

    for (const citation of demoCitations(location.id)) {
      entries.push({
        id: `cit:${citation.id}`,
        group: "citations",
        title: citation.directory,
        context: location.businessName,
        meta: citation.state.replace(/_/g, " "),
        target: {
          kind: "citation",
          locationId: location.id,
          citationId: citation.id,
        },
        locationId: location.id,
        haystack: `${citation.directoryType ?? ""} citation listing`,
      });
    }
  }

  for (const report of demoReportRows()) {
    if (report.locationId && !allowed.has(report.locationId)) continue;
    entries.push({
      id: `rpt:${report.id}`,
      group: "reports",
      title: report.name,
      context: report.locationName,
      meta: report.state,
      target: { kind: "report", reportId: report.id },
      locationId: report.locationId,
      haystack: `${report.clientName ?? ""} ${report.period ?? ""} ${report.type}`,
    });
  }

  if (scope.accountType === "agency") {
    const visible = scope.activeClientId
      ? DEMO_CLIENTS.filter((c) => c.id === scope.activeClientId)
      : DEMO_CLIENTS;
    for (const client of visible) {
      const count = DEMO_LOCATIONS.filter((l) => l.clientId === client.id).length;
      entries.push({
        id: `cli:${client.id}`,
        group: "clients",
        title: client.name,
        context: client.industry,
        meta: `${count} location${count === 1 ? "" : "s"}`,
        target: { kind: "client", clientId: client.id },
        locationId: null,
        haystack: "client account",
      });
    }
  }

  for (const item of primaryNavigation) {
    if (item.accountTypes && !item.accountTypes.includes(scope.accountType)) continue;
    entries.push({
      id: `page:${item.to}`,
      group: "pages",
      title: item.label,
      context: item.to,
      meta: null,
      target: { kind: "page", to: item.to },
      locationId: null,
      haystack: "navigation section",
    });
    for (const child of item.children ?? []) {
      entries.push({
        id: `page:${child.to}`,
        group: "pages",
        title: `${item.label} · ${child.label}`,
        context: child.to,
        meta: null,
        target: { kind: "page", to: child.to },
        locationId: null,
        haystack: "navigation section",
      });
    }
  }

  cache = { key, entries };
  return entries;
}

export type SearchGroup = { id: SearchGroupId; label: string; results: SearchResult[] };

const PER_GROUP_LIMIT = 5;

function score(result: SearchResult, query: string): number {
  const title = result.title.toLowerCase();
  const context = (result.context ?? "").toLowerCase();
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (context.includes(query)) return 3;
  if (result.haystack.toLowerCase().includes(query)) return 4;
  return -1;
}

/** Grouped matches, best first inside each group. */
export function searchIndex(entries: SearchResult[], rawQuery: string): SearchGroup[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const scored: { result: SearchResult; rank: number }[] = [];
  for (const result of entries) {
    const rank = score(result, query);
    if (rank >= 0) scored.push({ result, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || a.result.title.localeCompare(b.result.title));

  const groups: SearchGroup[] = [];
  for (const id of GROUP_ORDER) {
    const results = scored
      .filter((entry) => entry.result.group === id)
      .slice(0, PER_GROUP_LIMIT)
      .map((entry) => entry.result);
    if (results.length) groups.push({ id, label: SEARCH_GROUP_LABELS[id], results });
  }
  return groups;
}

/**
 * Suggestions shown before anything is typed: the locations in context, the
 * latest reports and the main sections. Only records that already exist.
 */
export function searchSuggestions(entries: SearchResult[], recentIds: string[]): SearchGroup[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const groups: SearchGroup[] = [];

  const recent = recentIds
    .map((id) => byId.get(id))
    .filter((entry): entry is SearchResult => Boolean(entry))
    .slice(0, 4);
  if (recent.length) groups.push({ id: "locations", label: "Recent", results: recent });

  const recentSet = new Set(recent.map((entry) => entry.id));
  const take = (group: SearchGroupId, limit: number) =>
    entries.filter((entry) => entry.group === group && !recentSet.has(entry.id)).slice(0, limit);

  const clients = take("clients", 3);
  if (clients.length)
    groups.push({ id: "clients", label: SEARCH_GROUP_LABELS.clients, results: clients });

  const locations = take("locations", 4);
  if (locations.length)
    groups.push({ id: "locations", label: SEARCH_GROUP_LABELS.locations, results: locations });

  const reports = take("reports", 3);
  if (reports.length)
    groups.push({ id: "reports", label: SEARCH_GROUP_LABELS.reports, results: reports });

  const pages = take("pages", 5);
  if (pages.length) groups.push({ id: "pages", label: SEARCH_GROUP_LABELS.pages, results: pages });

  return groups;
}

export function flattenGroups(groups: SearchGroup[]): SearchResult[] {
  return groups.flatMap((group) => group.results);
}

/** Recently opened results, kept for this browser only. */
const RECENT_KEY = "mypageseo.search.recent.v1";
const RECENT_LIMIT = 6;

export function readRecentSearchIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function rememberSearchId(id: string): string[] {
  const next = [id, ...readRecentSearchIds().filter((entry) => entry !== id)].slice(
    0,
    RECENT_LIMIT,
  );
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — recents are optional */
    }
  }
  return next;
}
